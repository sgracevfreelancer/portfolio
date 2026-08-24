#!/usr/bin/env node
/**
 * watch-gallery.js
 * ------------------------------------------------------------------
 * Watches assets/gallery/ for changes and reruns build-gallery.js
 * automatically, so data/gallery.json stays in sync while you drop in
 * new images/videos without having to run `npm run build:gallery`
 * by hand every time.
 *
 * Uses Node's built-in fs.watch (no npm install needed). Recursive
 * watching is supported natively on macOS and Windows; on Linux it
 * silently falls back to non-recursive, so only top-level category
 * folders would be watched there — fine for this project's macOS setup.
 *
 * Usage:
 *   node scripts/watch-gallery.js
 *   (or: npm run watch:gallery)
 *
 * Leave this running in a terminal while you work. Ctrl+C to stop.
 * Pair it with `npm start` (in another terminal) to preview the site
 * live, or just run `npm run dev` to get both at once.
 * ------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const GALLERY_DIR = path.join(ROOT, "assets", "gallery");
const BUILD_SCRIPT = path.join(__dirname, "build-gallery.js");
const DEBOUNCE_MS = 400;

let debounceTimer = null;
let building = false;
let rerunQueued = false;

function runBuild() {
  if (building) {
    rerunQueued = true;
    return;
  }
  building = true;
  try {
    const output = execFileSync(process.execPath, [BUILD_SCRIPT], { cwd: ROOT }).toString().trim();
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ${output}`);
  } catch (err) {
    console.error("Rebuild failed:", err.message);
  } finally {
    building = false;
    if (rerunQueued) {
      rerunQueued = false;
      runBuild();
    }
  }
}

function scheduleBuild() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runBuild, DEBOUNCE_MS);
}

function main() {
  if (!fs.existsSync(GALLERY_DIR)) {
    console.error(`No gallery folder found at ${GALLERY_DIR}`);
    process.exit(1);
  }

  console.log(`Watching ${path.relative(ROOT, GALLERY_DIR)}/ for changes... (Ctrl+C to stop)`);
  runBuild(); // build once on startup so gallery.json reflects current state immediately

  let watcher;
  try {
    watcher = fs.watch(GALLERY_DIR, { recursive: true }, (eventType, filename) => {
      // Ignore noise from editor swap files, .DS_Store, etc.
      if (filename && /(^\.|~$|\.tmp$)/.test(path.basename(filename))) return;
      scheduleBuild();
    });
  } catch (err) {
    // Recursive watching isn't supported on this platform (e.g. Linux) —
    // fall back to watching just the top-level category folders.
    console.warn("Recursive watch unsupported here; watching top-level category folders only.");
    const dirs = fs
      .readdirSync(GALLERY_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(GALLERY_DIR, d.name));
    dirs.forEach((dir) => fs.watch(dir, () => scheduleBuild()));
  }

  process.on("SIGINT", () => {
    if (watcher) watcher.close();
    console.log("\nStopped watching.");
    process.exit(0);
  });
}

main();
