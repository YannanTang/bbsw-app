# BBSW 2026 Conference App

A mobile-friendly progressive web app for the **Bay Area Biotech-Pharma Statistics Workshop 2026** (November 5–6, 2026, Foster City, CA).

Replaces the previous vendor phone app. Built with [Astro](https://astro.build) and deployed free on GitHub Pages.

## Pages

- Home — welcome and quick links
- Schedule — two-day agenda with session details
- Speakers — directory and individual speaker profiles
- Poster Sessions — accepted posters
- Sponsors — tiered sponsor listings
- Venue & Logistics — location, hotel, parking, Wi-Fi

## Content

All content lives as JSON in `src/data/`:

- `speakers.json` — id, name, title, affiliation, bio, photo, linkedin
- `sessions.json` — id, date, startTime, endTime, track, title, abstract, speakers (ids), room
- `sponsors.json` — id, name, tier (Diamond, Platinum, Gold, Silver), logo, website, description
- `posters.json` — id, title, presenters, affiliation, abstract

Speaker photos live in `public/speakers/`. Sponsor logos live in `public/sponsors/`.

The Sponsors page and each sponsor's detail page (`/sponsors/<id>`) are generated from `sponsors.json`. To add a sponsor, add its record to `sponsors.json` and put its logo in `public/sponsors/` — no page or code changes needed. `logo`, `website`, and `description` are optional (use `""`).

## Local development

```sh
npm install
npm run dev      # http://localhost:4321/bbsw-app
npm run build    # static build in dist/
npm run preview  # preview the production build
```

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via `.github/workflows/deploy.yml`.

Initial URL: `https://<user>.github.io/bbsw-app/`
Target URL: `https://app.bbsw.org/` (after DNS is configured)

To switch to the custom domain, update `astro.config.mjs`:

```js
site: 'https://app.bbsw.org',
base: '/',
```

…and add a `public/CNAME` file containing `app.bbsw.org`.

## Raffle

End-of-day raffle on Nov 5 and Nov 6. Attendees sign up on the raffle session pages (`/sessions/raffle-day1`, `/sessions/sponsor-talk-closing`); the short link `/raffle` (app.bbsw.org/raffle) sends them to the right one by Pacific date (Day 1 through Nov 5, Day 2 from Nov 6). The stage laptop runs the draw at `/raffle-stage` (not linked anywhere).

- **Sign-up is closed until the stage opens it.** At the start of the raffle session, press **Open sign-up** on the stage screen: it shows "open app.bbsw.org/raffle and enter the code" with the day's venue code. Sign-up stays open across draw rounds, with the link and code in the bottom-left corner of the draw screens so people can join anytime; press **Close sign-up** after the last round. On Day 2, sign-up can be opened at the start of the session and the screen switched to the sponsor slides; phones keep working.
- Sign-up needs the venue code and an email on the registration list. One entry per person per day; the two days are separate draws. There's no fixed number of winners: keep pressing **Draw another** until the host says stop.
- Winners must be in the room. **Not here — redraw** marks the winner as not present and draws again. Anyone drawn is out of that day's pool.
- Before Nov 5 the sign-up form is labeled a test run. Rehearse the stage anytime with `/raffle-stage?demo=1` (fake names, no backend).

**Backend (Google Apps Script, bbswtech@bbsw.org):**

1. Create a Google Sheet in the bbswtech@bbsw.org Drive → Extensions → Apps Script → paste `apps-script/raffle.gs` → run `setup()` once.
2. Paste the registration list into the **Attendees** tab (Email, Name). The name there is what the stage shows. Changes take up to 5 minutes to reach sign-up (the list is cached).
3. The **Settings** tab holds `stage_key` (typed once on the stage laptop), `day1_code`/`day2_code` and `day1_open`/`day2_open`. Edit codes there if you like (picked up within 10 seconds); the stage buttons flip the `_open` values right away.
4. Deploy → New deployment → Web app, execute as **Me**, access **Anyone**. Put the `/exec` URL in `src/data/raffle.json` → `endpoint`. After changing `raffle.gs`, paste it into the editor and use Deploy → Manage deployments → edit → **New version**, which keeps the same URL.

**Load:** tested on 2026-10-28 with simulated attendees. 200 sign-ups over a minute while 300 phones waited worked with no errors, and so did 100 at the same instant thanks to the phone's automatic retry. Apps Script allows only about 30 requests on the Sheet at once, so sign-ups don't take a lock (duplicates for one email are ignored when counting and drawing), and the phones' "is it open?" checks are answered from the cache.

The registration list, codes and stage key live only in the Sheet, never in this repo.

## Poster voting

People's choice vote on `/posters`: up to 3 posters per registered attendee, Nov 5 11:50 AM to Nov 6 2:00 PM (Pacific). Ballots go to the same Apps Script and Sheet as the raffle, so they're checked against the same **Attendees** list.

- The script enforces the window (`vote_open`, `vote_close` in **Settings**; `vote_posters` = number of posters). The page reads the same times from `src/data/raffle.json` → `voting` to decide what to show, and re-checks every 30 seconds.
- Before Nov 5 the form is a test run: ballots are stored with Kind `test` and never counted. Nothing to switch off before the conference.
- Ballots are append-only in the **Votes** tab; a new ballot from the same email replaces the earlier one when counting (latest wins).
- Results: run `tallyVotes()` in the Apps Script editor (Extensions > Apps Script). It writes the totals to the separate **BBSW 2026 Poster Voting Results** Sheet (id in Settings `vote_results_sheet`), which holds only posters and vote counts and can be shared with the poster chairs. `scheduleTally()` (run once in the editor as bbswtech@bbsw.org) sets it to run automatically 5 and 30 minutes after `vote_close`, and tallies once right away. Raffle winners stay in the raffle Sheet's **Draws** tab. Quick check without the editor: POST `{"action": "vote_results", "key": <stage_key>}`.
