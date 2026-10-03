# Maintainer Guide

Quick orientation for anyone working on the BBSW 2026 conference app.

## What this is

A static mobile-first PWA for the BBSW 2026 conference (Nov 5–6, 2026, Foster City). Built with Astro, deployed to GitHub Pages at **https://app.bbsw.org**.

The site is public: anyone can open it at app.bbsw.org.

## Maintainers

- **Yannan Tang** ([@YannanTang](https://github.com/YannanTang)) — architecture, system setup, design direction.

Content ingestion (speakers, sessions, sponsors, posters) is currently unassigned. If you've been added as a collaborator to help with content, read "Where things live" and "Workflow" below before your first push.

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
    index.astro     Redirects / to /home
    home.astro      Real app home (after unlock)
    schedule.astro, speakers/, sessions/, posters.astro, sponsors.astro, venue.astro
  layouts/
    BaseLayout.astro   Shared header, tab bar
  data/             JSON content — speakers, sessions, sponsors, posters
  styles/global.css
public/             Static assets (logo, icons, manifest, service worker, CNAME)
```

**Content edits** almost always live in `src/data/*.json` plus speaker/sponsor photos in `public/`. Page templates rarely need changes.

Photo naming: `speaker_lastname_firstname.jpg` in `public/`.

## Deploy

Push to `main` → GitHub Actions builds and deploys to `app.bbsw.org` in ~1 minute. Workflow lives in `.github/workflows/deploy.yml`. There is no staging environment, so use pull requests (see Workflow).

## Public access

The app is public (launched 2026-10-02). `/` redirects to `/home`; there is no passcode and pages are indexable by search engines.

## Workflow

The app is public, so mistakes are visible to everyone: work on a branch and open a pull request for review rather than pushing directly to `main`.

## Working with Claude Code

Maintainers use Claude Code for editing. Drop into the repo directory and run `claude` — the project's `CLAUDE.md` (if present) gives Claude an instant orientation. Ask Claude to update content, add pages, fix styling — it has full context of the structure above.

## Questions

Ping Yannan or open a GitHub issue.
