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

End-of-day raffle on Nov 5 and Nov 6. Attendees sign up on the raffle session pages (`/sessions/raffle-day1`, `/sessions/sponsor-talk-closing`); the stage laptop runs the draw at `/raffle-stage` (not linked anywhere).

- **Sign-up is closed until the stage opens it.** When the raffle starts, press **Open sign-up** on the stage screen: it shows a QR code and the day's venue code. Sign-up stays open across draw rounds; press **Close sign-up** after the last one.
- Sign-up needs the venue code and an email on the registration list. One entry per person per day; the two days are separate draws.
- Winners must be in the room. **Not here — redraw** marks the winner as not present and draws again. Anyone drawn is out of that day's pool.
- Rehearse anytime with `/raffle-stage?demo=1` (fake names, no backend).

**Backend (Google Apps Script, bbswtech@bbsw.org):**

1. Create a Google Sheet in the bbswtech@bbsw.org Drive → Extensions → Apps Script → paste `apps-script/raffle.gs` → run `setup()` once.
2. Paste the registration list into the **Attendees** tab (Email, Name). The name there is what the stage shows.
3. The **Settings** tab holds `stage_key` (typed once on the stage laptop), `day1_code`/`day2_code` and `day1_open`/`day2_open`. Edit codes there if you like; the stage buttons flip the `_open` values.
4. Deploy → New deployment → Web app, execute as **Me**, access **Anyone**. Put the `/exec` URL in `src/data/raffle.json` → `endpoint`.

The registration list, codes and stage key live only in the Sheet, never in this repo.
