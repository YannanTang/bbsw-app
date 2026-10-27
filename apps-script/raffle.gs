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
  const day = String(req.day || "");
  if (DAYS.indexOf(day) < 0) return json_({ ok: false, error: "bad_request" });

  // Public: phones ask whether sign-up is open (never the code).
  if (req.action === "state") {
    const open = isOpen_(day);
    return json_({ ok: true, open: open, ended: !open && draws_(day).length > 0 });
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

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const already = rows_("Entries").some((r) => r[0] === day && normEmail_(r[2]) === email);
    if (already) return { ok: true, already: true, name: registered.name || typed };
    sheet_("Entries").appendRow([day, new Date(), email, registered.name || typed, typed]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, already: false, name: registered.name || typed };
}

// ---- Stage screen ----

function status_(day) {
  const entries = rows_("Entries").filter((r) => r[0] === day);
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
    const pool = rows_("Entries").filter((r) => r[0] === day && !drawn[normEmail_(r[2])]);
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

// ---- Helpers ----

function draws_(day) {
  const out = [];
  rows_("Draws").forEach((r, i) => {
    if (r[0] === day) out.push({ name: String(r[3]), status: String(r[4]), drawRow: i + 2 });
  });
  return out;
}

function attendees_() {
  const map = {};
  rows_("Attendees").forEach((r) => {
    const email = normEmail_(r[0]);
    if (email) map[email] = { name: String(r[1] || "").trim() };
  });
  return map;
}

function setting_(key) {
  const row = rows_("Settings").find((r) => String(r[0]).trim() === key);
  return row ? row[1] : "";
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
