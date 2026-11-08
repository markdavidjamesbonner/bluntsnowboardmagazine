# Handoff: hosting + deployment for blunt snowboard magazine

Paste this into a new chat. Goal: get the site live on a free tier, with the flipbook page images hosted somewhere sensible, before December 1, 2026.

## Project snapshot

- **What it is:** a single-page advent calendar. A Three.js Christmas tree whose ornaments are the 22 Blunt snowboard magazine issues. One unlocks per day, Dec 1–25 (America/Toronto midnight), with three "burner" days (Dec 1, 11, and 22). Unlocked ornaments open a full-screen page-turning flipbook.
- **Local path:** `~/Desktop/personal_🚨/random_images_____random_junk/_magazines/blunt/bluntmagazineminutiae`. The folder name is legacy; the package is named `bluntsnowboardmagazine`.
- **Stack:** Vite 8, Vue 3, Three.js 0.187, `page-flip` 2.0.7. Node 26, npm 11. Plain CSS, no router.
- **Not a git repo yet.** No remote and no CI.
- **Commands:** `npm run dev` · `npm run build` (outputs `dist/`) · `npm run preview` · `npm test` (`node --test`, 23 tests) · `npm run flipbook` (renders pages from the PDFs) · `npm run covers` (renders ornament covers).

## What ships vs. what doesn't

| Asset | Size | Where it lives | Ships in `dist/`? |
| --- | --- | --- | --- |
| App build (JS/CSS/HTML + ornament covers) | ~3 MB | `dist/` (covers come from `public/content/issues/*/ornament.jpg`) | Yes |
| Flipbook pages (`page-NNN.webp` at 2000px, `thumb-NNN.webp` at 220px) | ~800 MB, 2,026 pages, ~400 KB per page | `flipbook_pages/<issueId>/` | **No.** Must be hosted separately |
| Page-count manifest | tiny | `src/content_manifest/flipbook_pages.json` (generated, imported by the app) | Bundled |
| Source PDFs | 1.1 GB, 22 files (26–79 MB each) | `blunt_magazine_complete_1_22/` | **No.** Local source for the render scripts only. Never upload or commit |

**How the app finds pages:**
- It builds image URLs as `${VITE_FLIPBOOK_BASE_URL}<issueId>/page-001.webp` (and `thumb-001.webp`). The helper is `src/utils/assetUrl.js` → `flipbookImageUrl()`.
- `VITE_FLIPBOOK_BASE_URL` must end with `/`.
- When it's unset, the app falls back to `./flipbook/`, which only works in dev/preview. There, `vite_plugins/serveLocalFiles.js` serves the local folder at `/flipbook/`.
- Issue ids are listed in `src/content_manifest/issues.js` (`issue-01`, `issue-03-1`, …, `issue-22`).

## Constraints

- **Free tier only.** No paid plans.
- **Domain:** `wetsandwich.com`, currently on GitHub Pages via the `markdavidjamesbonner.github.io` user-site repo.
- **Routing:** `vite.config.js` uses `base: './'` and routing is hash-based (`#/issue-12`). The build works at a domain root or a subpath, with no SPA rewrite rules needed.
- **Images:** loaded with plain `<img>` tags, never drawn into a canvas, so the image host doesn't need CORS headers.
- **Unlock gating is client-side only.** Anyone who guesses an image URL can see future pages. That's fine for a fun advent calendar; confirm it's acceptable before going live.

## Decisions to make in the new chat

1. **Where the app lives:**
   - **Subpath** (e.g. `wetsandwich.com/blunt/`): commit `dist/` contents into the user-site repo, or deploy with a GitHub Actions Pages workflow.
   - **Subdomain** (e.g. `blunt.wetsandwich.com`): a separate repo with its own Pages site and a `CNAME`.
2. **Where the ~800 MB of page images live:**
   - **Cloudflare R2** (likely best): 10 GB free storage, free egress. Use the public `r2.dev` URL, or a custom subdomain if `wetsandwich.com` DNS can be on Cloudflare.
   - **Backblaze B2 behind Cloudflare:** a free-egress alliance, but more setup.
   - **GitHub Pages itself:** possible but not recommended. It's close to the 1 GB soft repo limit and the 100 GB/month bandwidth limit, and it bloats git history.
3. **Upload method:** `rclone`, `wrangler r2 object put` in a loop, or the S3-compatible API.
4. **Caching:** page images never change once rendered, so set `Cache-Control: public, max-age=31536000, immutable` on them.
5. **Repo setup:** `git init`, plus a `.gitignore` that excludes at least `node_modules/`, `dist/`, `flipbook_pages/`, and `blunt_magazine_complete_1_22/`. Decide whether `dist/` is built in CI (preferred) or committed.

## Suggested task order

1. `git init`, add the `.gitignore` above, make a first commit, and create the GitHub repo.
2. Choose and set up the image host. Upload `flipbook_pages/` keeping the `<issueId>/page-NNN.webp` layout, and set cache headers.
3. Set `VITE_FLIPBOOK_BASE_URL` for production builds, via a GitHub Actions env var or a local `.env.production`. Keep any credentials in GitHub Secrets and never paste them into chat.
4. Add a GitHub Actions workflow that runs `npm ci`, `npm test`, and `npm run build`, then deploys `dist/` to Pages.
5. Point DNS at the chosen URL (subpath or subdomain) and confirm HTTPS works.
6. Verify the live site:
   - The tree loads and ornaments unlock on the right dates. The `?date=YYYY-MM-DD` override works in dev only, so test dates with `npm run dev` and a production-like env.
   - A flipbook opens and turns pages, thumbnails load, and zoom works.
   - A deep link (`#/issue-03`) works, and a link to a locked issue lands on the tree instead.
   - Images come from the image host with cache headers.
   - Test on desktop and a phone.

## Known gotchas

- **`flipbook_pages.json` must list all 22 issues.** The app intentionally throws at load if any issue is missing. Re-run `npm run flipbook` (it skips pages already rendered) after changing PDFs.
- **The render scripts need the PDFs locally.** `npm run covers` also needs macOS (`qlmanage`/`sips`); `npm run flipbook` is pure Node (`pdfjs-dist` + `@napi-rs/canvas`, dev dependencies only).
- **Bundle size:** the JS bundle is ~740 KB (~196 KB gzipped), mostly Three.js. Vite's chunk-size warning is expected.
- **Dev-only plugin:** `vite_plugins/serveLocalFiles.js` only runs in dev/preview. Nothing in it affects the production build.

## Status at handoff (Nov 8, 2026)

- The landing page (tree, ornaments, masthead, unlock logic) is done and approved.
- The flipbook viewer is built: hash routing, unlock-gated deep links, page-flip book, lazy page loading, thumbnail strip, and zoom. It was verified in the browser on desktop and phone sizes: page turns, thumbnails, zoom, Esc, deep links, and locked links.
- `npm run flipbook` has finished: all 22 issues, 2,026 pages, 796 MB in `flipbook_pages/`. Ready to upload.
