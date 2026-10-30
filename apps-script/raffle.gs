/**
 * BBSW 2026 end-of-day raffle — Google Apps Script web app.
 *
 * Lives in a Google Sheet owned by bbswtech@bbsw.org (see README "Raffle").
 * The Sheet holds everything private: the registration list, the daily venue
 * codes and the stage key. Nothing private is ever in this repo.
 *
 * Sheet tabs (created by setup()):
 *   Attendees  Email | Name                      ← paste the registration list
 *   Settings   Key | Value                       ← stage_key, day1_code, day2_code, day1_open, day2_open
 *   Entries    Day | Time | Email | Name | Typed name
 *   Draws      Day | Time | Email | Name | Status   (winner / not present)
 *   Votes      Time | Email | Name | Typed name | Posters | Kind   (poster voting: ballot / test)
 *
 * Poster voting results go to a separate Sheet (Settings: vote_results_sheet) that can be shared
 * with the poster chairs: it holds only posters and vote counts, never names or emails.
 *
 * Every request is a POST with a JSON body (sent as text/plain to avoid a CORS preflight).
 */

// Sign-up is closed until the stage screen opens it when the raffle starts,
// and stays open across draw rounds until the stage closes it.
const DAYS = ["day1", "day2"];

function setup() {
  const ss = SpreadsheetApp.getActive();
  const tabs = {
    Attendees: ["Email", "Name"],
    Settings: ["Key", "Value"],
    Entries: ["Day", "Time", "Email", "Name", "Typed name"],
    Draws: ["Day", "Time", "Email", "Name", "Status"],
    Votes: ["Time", "Email", "Name", "Typed name", "Posters", "Kind"],
  };
  Object.keys(tabs).forEach((name) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(tabs[name]);
  });
  const settings = ss.getSheetByName("Settings");
  if (settings.getLastRow() === 1) {
    settings.getRange(2, 1, 5, 2).setValues([
      ["stage_key", Utilities.getUuid().slice(0, 12)],
      ["day1_code", randomCode_()],
      ["day2_code", randomCode_()],
      ["day1_open", false],
      ["day2_open", false],
    ]);
  }
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (_) {
    return json_({ ok: false, error: "bad_request" });
  }
  // Poster voting shares the Attendees list with the raffle.
  if (req.action === "vote") return json_(vote_(req));
  if (req.action === "vote_results") {
    if (String(req.key || "") !== setting_("stage_key")) return json_({ ok: false, error: "bad_key" });
    return json_({ ok: true, results: voteResults_() });
  }

  const day = String(req.day || "");
  if (DAYS.indexOf(day) < 0) return json_({ ok: false, error: "bad_request" });

  // Public: phones ask whether sign-up is open (never the code). Every waiting phone asks every
  // 15 seconds, so the answer comes from the cache, leaving the Sheet free for sign-ups.
  if (req.action === "state") {
    const cache = CacheService.getScriptCache();
    const hit = cache.get("state_" + day);
    if (hit) return json_(JSON.parse(hit));
    const open = isOpen_(day);
    const state = { ok: true, open: open, ended: !open && draws_(day).length > 0 };
    cache.put("state_" + day, JSON.stringify(state), 5);
    return json_(state);
  }
  if (req.action === "enter") return json_(enter_(day, req));

  // Everything else is for the stage screen and needs the stage key.
  if (String(req.key || "") !== setting_("stage_key")) return json_({ ok: false, error: "bad_key" });
  if (req.action === "status") return json_(status_(day));
  if (req.action === "open" || req.action === "close") {
    setSetting_(day + "_open", req.action === "open");
    return json_(status_(day));
  }
  if (req.action === "draw") return json_(draw_(day));
  if (req.action === "absent") return json_(absent_(day, Number(req.drawRow)));
  return json_({ ok: false, error: "bad_request" });
}

// ---- Attendee sign-up ----

function enter_(day, req) {
  if (!isOpen_(day)) return { ok: false, error: "closed" };

  const code = String(req.code || "").trim().toUpperCase();
  if (!code || code !== String(setting_(day + "_code")).trim().toUpperCase()) {
    return { ok: false, error: "bad_code" };
  }

  const email = normEmail_(req.email);
  const typed = String(req.name || "").trim().slice(0, 100);
  if (!email || !typed) return { ok: false, error: "bad_request" };

  const registered = attendees_()[email];
  if (!registered) return { ok: false, error: "not_registered" };

  // The duplicate check stays outside the lock so sign-ups don't queue behind it.
  // Two near-simultaneous entries for one email can both land; entries_() keeps only the first.
  const already = rows_("Entries").some((r) => r[0] === day && normEmail_(r[2]) === email);
  if (!already) appendLocked_("Entries", [day, new Date(), email, registered.name || typed, typed]);
  return { ok: true, already: already, name: registered.name || typed };
}

// ---- Stage screen ----

function status_(day) {
  const entries = entries_(day);
  return {
    ok: true,
    code: String(setting_(day + "_code")),
    open: isOpen_(day),
    count: entries.length,
    // Names only (never emails) — the stage uses them for the spinning reel.
    names: entries.map((r) => String(r[3])),
    draws: draws_(day),
  };
}

function draw_(day) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // Anyone already drawn today (winner or not present) is out of the pool.
    const drawn = {};
    rows_("Draws").forEach((r) => { if (r[0] === day) drawn[normEmail_(r[2])] = true; });
    const pool = entries_(day).filter((r) => !drawn[normEmail_(r[2])]);
    if (pool.length === 0) return { ok: false, error: "empty" };

    const pick = pool[Math.floor(Math.random() * pool.length)];
    sheet_("Draws").appendRow([day, new Date(), normEmail_(pick[2]), pick[3], "winner"]);
    return { ok: true, name: String(pick[3]), drawRow: sheet_("Draws").getLastRow(), left: pool.length - 1 };
  } finally {
    lock.releaseLock();
  }
}

function absent_(day, drawRow) {
  const sh = sheet_("Draws");
  if (!(drawRow >= 2 && drawRow <= sh.getLastRow())) return { ok: false, error: "bad_request" };
  if (sh.getRange(drawRow, 1).getValue() !== day) return { ok: false, error: "bad_request" };
  sh.getRange(drawRow, 5).setValue("not present");
  return { ok: true, draws: draws_(day) };
}

// ---- Poster voting (people's choice) ----
// Settings: vote_open and vote_close (ISO times), vote_posters (number of posters) and
// vote_results_sheet (id of the separate results Sheet).
// Before the first voting day, ballots are accepted as a test run and marked "test"; they never count.

function vote_(req) {
  const now = new Date();
  const open = new Date(setting_("vote_open"));
  const close = new Date(setting_("vote_close"));
  const pt = (d) => Utilities.formatDate(d, "America/Los_Angeles", "yyyy-MM-dd");
  const rehearsal = pt(now) < pt(open);
  if (!rehearsal && now < open) return { ok: false, error: "vote_not_open" };
  if (now > close) return { ok: false, error: "vote_closed" };

  const email = normEmail_(req.email);
  const typed = String(req.name || "").trim().slice(0, 100);
  if (!email || !typed) return { ok: false, error: "bad_request" };

  const max = Number(setting_("vote_posters")) || 0;
  const sent = Array.isArray(req.votes) ? req.votes.map((v) => String(v).trim()) : [];
  const picks = sent.filter((v, i) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= max && sent.indexOf(v) === i);
  if (picks.length < 1 || picks.length > 3 || picks.length !== sent.length) return { ok: false, error: "bad_votes" };

  const registered = attendees_()[email];
  if (!registered) return { ok: false, error: "not_registered" };

  // Append only: the latest ballot per email is the one that counts (see voteResults_).
  appendLocked_("Votes", [now, email, registered.name || typed, typed, picks.join(","), rehearsal ? "test" : "ballot"]);
  return { ok: true, test: rehearsal, name: registered.name || typed };
}

// Real ballots only, the latest one per email.
function latestBallots_() {
  const latest = {};
  rows_("Votes").forEach((r) => {
    if (r[5] !== "ballot") return;
    const email = normEmail_(r[1]);
    if (!latest[email] || r[0] > latest[email][0]) latest[email] = r;
  });
  return Object.keys(latest).map((e) => latest[e]);
}

// Returns [{ poster, votes }] sorted by votes.
function voteResults_() {
  const counts = {};
  latestBallots_().forEach((r) => String(r[4]).split(",").forEach((p) => { counts[p] = (counts[p] || 0) + 1; }));
  return Object.keys(counts).map((p) => ({ poster: Number(p), votes: counts[p] })).sort((a, b) => b.votes - a.votes || a.poster - b.poster);
}

// Run from the Apps Script editor after voting closes (Extensions > Apps Script > tallyVotes).
// Writes the totals, with titles from its Posters tab, to the Results tab of the results Sheet.
function tallyVotes() {
  const out = SpreadsheetApp.openById(String(setting_("vote_results_sheet")));
  const info = {};
  const posters = out.getSheetByName("Posters");
  if (posters && posters.getLastRow() > 1) {
    posters.getRange(2, 1, posters.getLastRow() - 1, 3).getValues().forEach((r) => { info[r[0]] = r; });
  }
  const rows = voteResults_().map((r) => {
    const id = "P" + String(r.poster).padStart(2, "0");
    const p = info[id] || [];
    return [id, p[1] || "", p[2] || "", r.votes];
  });
  const sh = out.getSheetByName("Results") || out.insertSheet("Results");
  sh.clearContents();
  sh.getRange(1, 1, 1, 4).setValues([["Poster", "Title", "Presenter", "Votes"]]);
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  const when = Utilities.formatDate(new Date(), "America/Los_Angeles", "MMM d, h:mm a");
  sh.getRange(rows.length + 3, 1).setValue(`Updated ${when} PT from ${latestBallots_().length} ballots.`);
}

// ---- Helpers ----

// appendRow isn't safe when requests arrive together: two can land on the same row and one is
// lost (the load test lost ~40%). So each append takes the script lock, held only for the write.
function appendLocked_(name, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    sheet_(name).appendRow(row);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

// The day's entries, one per email (the first one).
function entries_(day) {
  const seen = {};
  return rows_("Entries").filter((r) => {
    const email = normEmail_(r[2]);
    if (r[0] !== day || seen[email]) return false;
    seen[email] = true;
    return true;
  });
}

function draws_(day) {
  const out = [];
  rows_("Draws").forEach((r, i) => {
    if (r[0] === day) out.push({ name: String(r[3]), status: String(r[4]), drawRow: i + 2 });
  });
  return out;
}

// Cached for 5 minutes so a rush of sign-ups doesn't re-read the whole list each time.
// Edits to the Attendees tab show up within 5 minutes.
function attendees_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("attendees");
  if (hit) return JSON.parse(hit);
  const map = {};
  rows_("Attendees").forEach((r) => {
    const email = normEmail_(r[0]);
    if (email) map[email] = { name: String(r[1] || "").trim() };
  });
  try { cache.put("attendees", JSON.stringify(map), 300); } catch (_) {} // over 100 KB: just don't cache
  return map;
}

// Settings are cached for 10 seconds; the stage's open/close clears the cache right away.
function setting_(key) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("settings");
  let map = hit ? JSON.parse(hit) : null;
  if (!map) {
    map = {};
    rows_("Settings").forEach((r) => { map[String(r[0]).trim()] = r[1]; });
    cache.put("settings", JSON.stringify(map), 10);
  }
  return key in map ? map[key] : "";
}

function isOpen_(day) {
  const v = setting_(day + "_open");
  return v === true || String(v).toUpperCase() === "TRUE";
}

function setSetting_(key, value) {
  const sh = sheet_("Settings");
  const i = rows_("Settings").findIndex((r) => String(r[0]).trim() === key);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(value);
  else sh.appendRow([key, value]);
  CacheService.getScriptCache().removeAll(["settings", "state_day1", "state_day2"]);
}

function rows_(name) {
  const sh = sheet_(name);
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, sh.getLastColumn()).getValues() : [];
}

function sheet_(name) {
  return SpreadsheetApp.getActive().getSheetByName(name);
}

function normEmail_(v) {
  return String(v || "").trim().toLowerCase();
}

// 4 characters, no look-alikes (0/O, 1/I/L).
function randomCode_() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
