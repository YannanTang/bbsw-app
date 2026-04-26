# Maintainer Guide

Quick orientation for anyone working on the BBSW 2026 conference app.

## What this is

A static mobile-first PWA for the BBSW 2026 conference (Nov 5–6, 2026, Foster City). Built with Astro, deployed to GitHub Pages at **https://app.bbsw.org**.

Pre-launch the site is gated: visitors see a "Coming Soon" splash; the real app is only reachable with the committee passcode. After public launch (late Oct 2026), the gate comes off.

## Maintainers

- **Yannan Tang** ([@YannanTang](https://github.com/YannanTang)) — architecture, system setup, design direction.
- **Xuefeng Hou** ([@hxfjoshua](https://github.com/hxfjoshua)) — content ingestion: speakers, sessions, sponsors, posters.

## Get running locally

Requirements: Node 20+ and git.

```bash
git clone https://github.com/YannanTang/bbsw-app.git
cd bbsw-app
npm install
npm run dev          # http://localhost:4321
npm run build        # produces ./dist
```

If you don't want a local install, **GitHub Codespaces** works out of the box (Code → Codespaces → Create).

## Where things live

```
src/
  pages/            URL routes (one .astro file per page)
    index.astro     Pre-launch splash + passcode gate
    home.astro      Real app home (after unlock)
    schedule.astro, speakers/, sessions/, posters.astro, sponsors.astro, venue.astro
  layouts/
    BaseLayout.astro   Shared header, tab bar, gate guard, noindex meta
  data/             JSON content — speakers, sessions, sponsors, posters
  styles/global.css
public/             Static assets (logo, icons, manifest, service worker, CNAME)
```

**Content edits** almost always live in `src/data/*.json` plus speaker/sponsor photos in `public/`. Page templates rarely need changes.

Photo naming: `speaker_lastname_firstname.jpg` in `public/`.

## Deploy

Push to `main` → GitHub Actions builds and deploys to `app.bbsw.org` in ~1 minute. Workflow lives in `.github/workflows/deploy.yml`. There is no staging environment; the gate is the safety net pre-launch.

## The pre-launch gate

- Splash at `/` shows "Coming Soon" with a hidden "Committee access" link.
- Real app lives at `/home`, `/schedule`, etc., gated by `localStorage.bbsw_gate === "open"`.
- Committee preview URL: **`https://app.bbsw.org/?k=bbsw-committee-2026`** (auto-unlocks).
- To change the passcode: edit `GATE_PASSCODE` in `src/pages/index.astro` and push.
- Site-wide `<meta name="robots" content="noindex,nofollow">` keeps it out of search results.

## Workflow

**Pre-launch (now → late Oct 2026):** push directly to `main`. Mistakes go live but only committee sees them.

**Post-launch (late Oct onward):** switch to pull requests for review. Yannan will flip this when the gate comes off.

## Working with Claude Code

Both maintainers use Claude Code for editing. Drop into the repo directory and run `claude` — the project's `CLAUDE.md` (if present) gives Claude an instant orientation. Ask Claude to update content, add pages, fix styling — it has full context of the structure above.

## Questions

Ping Yannan or open a GitHub issue.
