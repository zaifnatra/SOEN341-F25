// scripts/build.js

// 1) Import filesystem and path utilities from Node
const fs = require('fs');
const path = require('path');

// 2) Define absolute paths for input (frontend/) and output (dist/)
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const DIST_DIR = path.join(__dirname, '..', 'dist');

/**
 * 3) Recursively copy a file or directory:
 *    - If src is a folder, ensure dest exists, then copy each child.
 *    - If src is a file, copy it directly.
 */
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);               // get file/folder metadata
  if (stat.isDirectory()) {                    // handle directory
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true }); // create dest folder tree if missing
    }
    for (const entry of fs.readdirSync(src)) { // iterate entries in the folder
      copyRecursive(
        path.join(src, entry),                 // source child path
        path.join(dest, entry)                 // destination child path
      );
    }
  } else {                                     // handle file
    fs.copyFileSync(src, dest);                // copy file bytes
  }
}

/**
 * 4) Small guard: verify a path exists. If not, print error and fail CI.
 */
function ensureExists(p, label) {
  if (!fs.existsSync(p)) {
    console.error(`[BUILD] Missing ${label}: ${p}`);
    process.exit(1);                           // non-zero exit → CI fails early and clearly
  }
}

/**
 * 5) Main build flow:
 *    - Validate expected inputs exist.
 *    - Recreate a clean dist/ directory.
 *    - Copy all frontend assets into dist/.
 */
(function main() {
  console.log('[BUILD] Start');

  // 5a) Ensure the source folder and its entry HTML exist
  ensureExists(FRONTEND_DIR, 'frontend directory');
  ensureExists(path.join(FRONTEND_DIR, 'index.html'), 'frontend/index.html');

  // 5b) Clean previous dist/ (if any) for reproducible builds
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true }); // remove old dist/
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });             // create fresh dist/

  // 5c) Copy entire frontend/ tree (HTML, CSS, JS, images) to dist/
  copyRecursive(FRONTEND_DIR, DIST_DIR);

  console.log('[BUILD] Copied frontend → dist/');
  console.log('[BUILD] Done');
})();
