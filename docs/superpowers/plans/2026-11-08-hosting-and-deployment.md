# Hosting and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the Blunt advent calendar live at `https://wetsandwich.com/blunt/` before Dec 1, 2026, with flipbook images on Cloudflare Pages.

**Architecture:** The 796 MB of rendered page images deploy from this Mac to a Cloudflare Pages project (`blunt-flipbook.pages.dev`) with immutable cache headers. The ~3 MB Vite build is mirrored into the personal site repo (`wetsandwich_2026/public/blunt/`), following that repo's existing `public/sandbox/<name>/` convention; pushing it triggers Netlify's normal rebuild. This project gets its own GitHub repo with a test-only CI workflow.

**Tech Stack:** Vite 8, Vue 3, Cloudflare Pages (direct upload via `wrangler`), Netlify (existing Quasar site), GitHub Actions.

## Global Constraints

- Free tier only (Cloudflare Pages free: 20,000 files/site, 25 MiB/file, unlimited bandwidth).
- `wetsandwich.com` is served by Netlify from `github.com/markdavidjamesbonner/wetsandwich_2026` (`main` auto-deploys). DNS is at GoDaddy and does not change.
- `VITE_FLIPBOOK_BASE_URL` must end with `/`.
- Never commit or upload `blunt_magazine_complete_1_22/` (source PDFs).
- Credentials go through browser logins (`wrangler login`, `gh auth login`) only; never pasted into chat or committed.
- No push to either GitHub repo without the user's explicit go-ahead.
- Unlock gating stays client-side; guessable image URLs are accepted.

## Current facts (verified Nov 8, 2026)

- `npm run flipbook` is complete: 22 issues, 2,026 pages + 2,026 thumbs, manifest matches disk, no file > 25 MiB.
- Netlify 301s `/folder` → `/folder/`, so `base: './'` resolves correctly at `/blunt/`.
- Netlify's catch-all `/* → /index.html 200` rewrite is non-forced, so real files under `/blunt/` take precedence.

---

### Task 1: Repo, ignore rules, and test-only CI

**Files:**
- Modify: `.gitignore`
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: Ignore rendered pages**

Append to `.gitignore`:

```
# ~800MB of rendered page images: hosted on Cloudflare Pages, regenerate with `npm run flipbook`
flipbook_pages/
```

- [ ] **Step 2: Add CI workflow**

```yaml
name: test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 26
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
```

- [ ] **Step 3: Init and verify nothing heavy is staged**

Run: `git init -b main && git add -A && git status --short | grep -E "flipbook_pages|blunt_magazine_complete|dist/|node_modules" ; du -sh .git`
Expected: grep prints nothing; `.git` is a few MB at most.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: initial commit with test-only CI"
```

- [ ] **Step 5: Create GitHub repo (user runs `gh auth login` as `markdavidjamesbonner` first)**

Run: `gh repo create markdavidjamesbonner/bluntsnowboardmagazine --private --source . --remote origin`
Push only after user approval: `git push -u origin main`. Confirm the `test` workflow goes green.

---

### Task 2: Deploy flipbook images to Cloudflare Pages

**Files:**
- Create: `deploy/flipbook_headers`
- Modify: `package.json` (devDependency `wrangler`, script `deploy:flipbook`)

- [ ] **Step 1: Install and vet wrangler**

Run: `npm install --save-dev wrangler && npm audit`
Expected: report results to the user; if high/critical issues exist, stop and discuss.

- [ ] **Step 2: Add the headers file**

`deploy/flipbook_headers`:

```
/*
  Cache-Control: public, max-age=31536000, immutable
```

- [ ] **Step 3: Add the deploy script to `package.json`**

```json
"deploy:flipbook": "cp deploy/flipbook_headers flipbook_pages/_headers && wrangler pages deploy flipbook_pages --project-name blunt-flipbook --branch main --commit-dirty=true"
```

- [ ] **Step 4: Log in and create the project (user, browser flow)**

Run: `npx wrangler login` then `npx wrangler pages project create blunt-flipbook --production-branch main`

- [ ] **Step 5: Deploy**

Run: `npm run deploy:flipbook`
Expected: 4,052 files uploaded; output ends with a `https://….blunt-flipbook.pages.dev` URL.

- [ ] **Step 6: Verify hosting and headers**

Run: `curl -sI https://blunt-flipbook.pages.dev/issue-12/page-001.webp` and the same for `thumb-001.webp`
Expected: `HTTP/2 200`, `content-type: image/webp`, `cache-control: public, max-age=31536000, immutable`.

- [ ] **Step 7: Commit**

```bash
git add deploy/flipbook_headers package.json package-lock.json
git commit -m "feat: deploy flipbook pages to Cloudflare Pages"
```

---

### Task 3: Production image base URL

**Files:**
- Create: `.env.production`

- [ ] **Step 1: Add env file (public URL, not a secret; `.env*.local` stays ignored)**

```
VITE_FLIPBOOK_BASE_URL=https://blunt-flipbook.pages.dev/
```

- [ ] **Step 2: Build and confirm the URL is baked in**

Run: `npm run build && grep -l "blunt-flipbook.pages.dev/" dist/assets/*.js`
Expected: one JS file matched.

- [ ] **Step 3: Smoke test against the real image host**

Nothing unlocks before Dec 1 and `?date=` is dev-only, so run dev pointed at Cloudflare:
`VITE_FLIPBOOK_BASE_URL=https://blunt-flipbook.pages.dev/ npm run dev`, open `/?date=2026-12-25#/issue-12`, and confirm in DevTools Network that pages and thumbs load from `blunt-flipbook.pages.dev`.

- [ ] **Step 4: Commit**

```bash
git add .env.production
git commit -m "feat: point production flipbook images at Cloudflare Pages"
```

---

### Task 4: Publish the app into the personal site

**Files:**
- Modify: `package.json` (script `publish:site`)
- Generated: `~/Desktop/personal_🚨/wet_sandwich/wetsandwich_2026/public/blunt/`

- [ ] **Step 1: Add the publish script**

```json
"publish:site": "npm run build && rsync -a --delete --exclude .DS_Store dist/ ../../../../wet_sandwich/wetsandwich_2026/public/blunt/"
```

- [ ] **Step 2: Run it and inspect the result**

Run: `npm run publish:site && ls ../../../../wet_sandwich/wetsandwich_2026/public/blunt/ && git -C ../../../../wet_sandwich/wetsandwich_2026 status --short`
Expected: `index.html`, `assets/`, and `content/` present; only `public/blunt/` changes in the site repo.

- [ ] **Step 3: Commit this repo's script**

```bash
git add package.json
git commit -m "chore: add publish:site script"
```

- [ ] **Step 4: Commit and push the site repo (user approves the push)**

```bash
git -C ../../../../wet_sandwich/wetsandwich_2026 add public/blunt
git -C ../../../../wet_sandwich/wetsandwich_2026 commit -m "blunt advent calendar added at /blunt/"
git -C ../../../../wet_sandwich/wetsandwich_2026 push
```

Expected: Netlify deploy succeeds.

---

### Task 5: Live verification

- [ ] `curl -sI https://wetsandwich.com/blunt` → `301` to `/blunt/`; `/blunt/` → `200 text/html` with the advent `index.html` (not the Quasar shell).
- [ ] Homepage `https://wetsandwich.com/#/` still loads normally.
- [ ] Tree renders; ornament covers load from `wetsandwich.com/blunt/content/...`.
- [ ] Before Dec 1 nothing is unlocked; date behaviour verified via `npm run dev` with `?date=2026-12-01`, `?date=2026-12-11`, and `?date=2026-12-25`.
- [ ] Deep link to a locked issue (`/blunt/#/issue-12` today) lands on the tree.
- [ ] Via `VITE_FLIPBOOK_BASE_URL=https://blunt-flipbook.pages.dev/ npm run dev` with `?date=2026-12-25`, a flipbook opens, turns pages, shows thumbnails, and zooms; images come from `blunt-flipbook.pages.dev` with the immutable cache header.
- [ ] On Dec 1, recheck the live site with no override: the Dec 1 ornament opens and its pages load.
- [ ] Repeat on a phone.

## Rollback

- App: `rm -rf public/blunt` in `wetsandwich_2026`, commit, and push (user approval required); Netlify redeploys without it.
- Images: delete the `blunt-flipbook` Pages project in the Cloudflare dashboard.
