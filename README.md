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
