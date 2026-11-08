// Renders page 1 of every issue PDF with macOS Quick Look, then writes
// public/content/issues/<id>/ornament.jpg (512px long edge, GPU-friendly tree texture).
// Rendering large and downsampling keeps the small texture sharp.
// Usage: npm run covers [-- --force]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ISSUES } from '../src/content_manifest/issues.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF_DIRECTORY = path.join(PROJECT_ROOT, 'blunt_magazine_complete_1_22');
const OUTPUT_DIRECTORY = path.join(PROJECT_ROOT, 'public', 'content', 'issues');
const RENDER_LONG_EDGE = 1200;
const ORNAMENT_LONG_EDGE = 512;

const shouldForce = process.argv.includes('--force');

if (process.platform !== 'darwin') {
  throw new Error('extract_covers relies on macOS qlmanage + sips.');
}

const scratchDirectory = mkdtempSync(path.join(tmpdir(), 'bmm_covers_'));
let failureCount = 0;

try {
  for (const issue of ISSUES) {
    const pdfPath = path.join(PDF_DIRECTORY, issue.pdfFile);
    const issueDirectory = path.join(OUTPUT_DIRECTORY, issue.id);
    const ornamentPath = path.join(issueDirectory, 'ornament.jpg');

    if (!existsSync(pdfPath)) {
      console.error(`missing PDF for ${issue.id}: ${pdfPath}`);
      failureCount += 1;
      continue;
    }
    if (!shouldForce && existsSync(ornamentPath)) {
      console.log(`skip ${issue.id} (exists)`);
      continue;
    }

    mkdirSync(issueDirectory, { recursive: true });

    try {
      execFileSync('qlmanage', ['-t', '-s', String(RENDER_LONG_EDGE), '-o', scratchDirectory, pdfPath], {
        stdio: 'ignore',
      });
      const renderedPng = path.join(scratchDirectory, `${issue.pdfFile}.png`);
      if (!existsSync(renderedPng)) {
        throw new Error('qlmanage produced no thumbnail');
      }

      execFileSync(
        'sips',
        ['-Z', String(ORNAMENT_LONG_EDGE), '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', renderedPng, '--out', ornamentPath],
        { stdio: 'ignore' },
      );
      console.log(`ok   ${issue.id}`);
    } catch (error) {
      console.error(`fail ${issue.id}`, error);
      failureCount += 1;
    }
  }
} finally {
  rmSync(scratchDirectory, { recursive: true, force: true });
}

if (failureCount > 0) {
  process.exitCode = 1;
}
