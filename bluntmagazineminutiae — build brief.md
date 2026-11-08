bluntsnowboardmagazine — build brief

Single-page advent calendar for releasing a complete Blunt snowboard magazine collection. Public site on wetsandwich.com. Brand: bluntsnowboardmagazine.

Build location (Mark's Mac):

/Users/admintam/Desktop/personal_🚨/random_images_____random_junk/_magazines/blunt/bluntsnowboardmagazine

PDFs already present: blunt_magazine_complete_1_22/ (22 issue PDFs). Extract the first page of each PDF as the cover/ornament image. Full PDFs are the issue links for now (flipbook can come later). Total PDFs >1GB — host/load strategy later; for local build, keep assets local and do not try to ship all PDFs to GitHub Pages yet.

Product shape





Off-white full-bleed page. Centerpiece: realistic Three.js Christmas tree that auto-rotates; drag/swipe overrides, then ease back into auto-spin.



~25 Blunt issues + December gap fillers (ephemera: photos, ads, stickers, interviews from the collection) hang as cover-sized ornaments.



Unlock timezone: America/Toronto.





Before Dec 1 → everything grayed, teaser only



Each Toronto midnight → that day’s ornament lights up and becomes clickable



Magazines → open issue (PDF link for v1; flipbook later)



Extras → whatever fits (lightbox / gallery / short viewer)



After Dec 31 → full archive, all lit and openable



Locked clicks: no navigation — maybe a tiny “not yet” cue, nothing chatty.



Audience: public URL, anyone with the link.

Layout

One composition, not a dashboard.

First viewport





Brand bluntsnowboardmagazine as hero-level signal (not a tiny nav label)



One short supporting line under it (copy later)



No day counters, no “today’s unlock” cards, no schedule strips



No “today” label in the hero



Dominant visual: the tree, edge-to-edge — the page is the tree on off-white, not a card in a layout



Ornaments are the UI; flipbook/extra viewer opens as overlay or separate route from a click, not embedded in the hero

Mobile





Same composition; tree scales down; drag-to-spin primary; auto-rotate gentler



Ornaments tappable; no hover-only states

Visual direction





Off-white ground, warm tree light



Avoid purple-on-white, cream+serif+terracotta clichés, dark-mode default, glow stacks, pill clusters



Blunt covers carry most of the color; coral/lime only as sparse accents if needed

Stack





Vite + Vue + Three.js (Approach 1 from planning)



Vue owns day state, content metadata, routing to viewers



Three.js owns the tree scene: realistic tree, warm lights, each issue/extra as textured plane ornament



Locked = desaturated/dimmed materials; unlocked = material pops + optional soft emissive



Orbit controls: auto-rotate + drag override



Static build target: GitHub Pages on wetsandwich.com (later)

Assets (v1)

From blunt_magazine_complete_1_22/:





List all 22 PDFs



Extract first page of each as cover JPG/WebP (~800–1200px long edge) into something like content/issues/issue-NN/cover.jpg



Keep/link each PDF as the full issue for click-through



Gap-day extras: placeholders OK until Mark adds ephemera

Do not require flipbook page rasters for v1 — PDF link is enough until hosting is figured out.

Build order





Scaffold Vite + Vue in the workspace root (beside the PDF folder; do not delete PDFs)



Extract covers from the 22 PDFs



Content manifest (day → issue or extra, unlock date, cover path, PDF/url)



Tree scene with ornaments using real covers



Unlock gating (America/Toronto)



Click unlocked ornament → open PDF (issues) or placeholder viewer (extras)



Pre-Dec teaser / post-Dec archive states



Defer: flipbook, CDN/hosting for 1GB+ PDFs, final copy

Out of scope for first pass





Shipping full PDFs to production hosting



Final hero copy



Gap-day ephemera content (slots only)



Perfect photoreal tree model polish (good enough realistic tree is fine)

