// Renders every page of every issue PDF for the flipbook:
//   flipbook_pages/<id>/page-001.webp   (2000px long edge: sharp at spread size and when zoomed)
//   flipbook_pages/<id>/thumb-001.webp  (220px long edge, for the thumbnail strip)
// and records each issue's page count and page shape in src/content_manifest/flipbook_pages.json.
// flipbook_pages/ is ~600MB and never ships in dist/; dev serves it locally (see vite.config.js).
// Usage: npm run flipbook [-- --force] [-- --only=issue-12]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { ISSUES } from '../src/content_manifest/issues.js';
import { flipbookPageFile } from '../src/utils/flipbookPageFile.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF_DIRECTORY = path.join(PROJECT_ROOT, 'blunt_magazine_complete_1_22');
const OUTPUT_DIRECTORY = path.join(PROJECT_ROOT, 'flipbook_pages');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'src', 'content_manifest', 'flipbook_pages.json');
const PAGE_LONG_EDGE = 2000;
const THUMB_LONG_EDGE = 220;
const PAGE_QUALITY = 78;
const THUMB_QUALITY = 70;

const shouldForce = process.argv.includes('--force');
const onlyId = process.argv.find((argument) => argument.startsWith('--only='))?.slice('--only='.length);

function readManifest() {
  return existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};
}

function isIssueRendered(issueDirectory, pageCount) {
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    if (
      !existsSync(path.join(issueDirectory, flipbookPageFile('page', pageNumber))) ||
      !existsSync(path.join(issueDirectory, flipbookPageFile('thumb', pageNumber)))
    ) {
      return false;
    }
  }
  return true;
}

async function renderIssue(issue, manifest) {
  const pdfPath = path.join(PDF_DIRECTORY, issue.pdfFile);
  const issueDirectory = path.join(OUTPUT_DIRECTORY, issue.id);
  const known = manifest[issue.id];
  if (!shouldForce && known && isIssueRendered(issueDirectory, known.pageCount)) {
    console.log(`skip ${issue.id} (${known.pageCount} pages exist)`);
    return;
  }
  if (!existsSync(pdfPath)) {
    throw new Error(`missing PDF for ${issue.id}: ${pdfPath}`);
  }
  mkdirSync(issueDirectory, { recursive: true });

  const loadingTask = getDocument({ data: new Uint8Array(readFileSync(pdfPath)), verbosity: 0 });
  const document = await loadingTask.promise;
  let aspect = null;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const unscaled = page.getViewport({ scale: 1 });
      const scale = PAGE_LONG_EDGE / Math.max(unscaled.width, unscaled.height);
      const viewport = page.getViewport({ scale });
      // The first page fixes the book's shape; later pages are fitted into it by the viewer.
      aspect ??= unscaled.width / unscaled.height;

      const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      writeFileSync(path.join(issueDirectory, flipbookPageFile('page', pageNumber)), await canvas.encode('webp', PAGE_QUALITY));

      const thumbScale = THUMB_LONG_EDGE / Math.max(canvas.width, canvas.height);
      const thumb = createCanvas(Math.round(canvas.width * thumbScale), Math.round(canvas.height * thumbScale));
      thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
      writeFileSync(path.join(issueDirectory, flipbookPageFile('thumb', pageNumber)), await thumb.encode('webp', THUMB_QUALITY));
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  manifest[issue.id] = { pageCount: document.numPages, aspect: Number(aspect.toFixed(4)) };
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`ok   ${issue.id} (${document.numPages} pages)`);
}

const manifest = readManifest();
let failureCount = 0;
for (const issue of ISSUES.filter((candidate) => !onlyId || candidate.id === onlyId)) {
  try {
    await renderIssue(issue, manifest);
  } catch (error) {
    console.error(`fail ${issue.id}`, error);
    failureCount += 1;
  }
}
if (failureCount > 0) {
  process.exitCode = 1;
}
