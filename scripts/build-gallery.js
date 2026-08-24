#!/usr/bin/env node
/**
 * build-gallery.js
 * ------------------------------------------------------------------
 * Scans assets/gallery/<Category>/ for images AND videos and writes
 * data/gallery.json, which gallery.html reads to render the
 * sortable/filterable grid.
 *
 * How auto-population works:
 *   - Each top-level folder under assets/gallery/ becomes a filter category
 *     (its folder name, e.g. "Social-Media" -> shown as "Social Media").
 *   - Each image or video file inside becomes one gallery item.
 *   - The title is derived from the filename (dashes/underscores -> spaces,
 *     title-cased), unless you add explicit tags — see below.
 *   - Optional tagging: name a file "My Title__tag1,tag2.jpg" (double
 *     underscore separates the title from a comma-separated tag list).
 *   - The item date is the file's last-modified time, used for the
 *     "Newest" sort on the gallery page.
 *
 * Video support:
 *   - Supported: .mp4, .webm, .mov, .m4v
 *   - Videos autoplay muted on hover in the grid and play with sound in
 *     the lightbox on click.
 *   - Poster images (the static thumbnail shown before hover/click) are
 *     picked up automatically if you name them to match the video, e.g.:
 *       Weekly-Recap.mp4
 *       Weekly-Recap-Cover.jpg      <- used as poster
 *     Any of these suffixes work: "-cover", "-poster", ".cover", ".poster"
 *     (case-insensitive). A poster image is consumed by its video and is
 *     NOT also listed as a separate gallery item. Without a matching
 *     poster file, the browser shows the video's first frame instead.
 *
 * Usage:
 *   node scripts/build-gallery.js
 *   (or: npm run build:gallery)
 *
 * Run this any time you add, remove, or rename files in assets/gallery/.
 * A GitHub Action (.github/workflows/build-gallery.yml) also runs it
 * automatically whenever assets/gallery/** changes on push.
 * ------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GALLERY_DIR = path.join(ROOT, "assets", "gallery");
const OUTPUT_FILE = path.join(ROOT, "data", "gallery.json");

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov", ".m4v"]);
const POSTER_SUFFIXES = ["-cover", "-poster", ".cover", ".poster"];

function titleCase(str) {
  return str
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseFilename(filename) {
  const ext = path.extname(filename);
  let base = path.basename(filename, ext);
  let tags = [];

  if (base.includes("__")) {
    const [titlePart, tagPart] = base.split("__");
    base = titlePart;
    tags = tagPart.split(",").map((t) => t.trim()).filter(Boolean);
  }

  return { base, title: titleCase(base), tags };
}

function findPoster(base, filesByLowerName) {
  for (const suffix of POSTER_SUFFIXES) {
    for (const imgExt of IMAGE_EXTS) {
      const candidate = `${base}${suffix}${imgExt}`.toLowerCase();
      if (filesByLowerName.has(candidate)) return filesByLowerName.get(candidate);
    }
  }
  return null;
}

function main() {
  if (!fs.existsSync(GALLERY_DIR)) {
    console.error(`No gallery folder found at ${GALLERY_DIR}`);
    process.exit(1);
  }

  const categories = fs
    .readdirSync(GALLERY_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();

  const items = [];
  let videoCount = 0;

  for (const category of categories) {
    const dirPath = path.join(GALLERY_DIR, category);
    const allFiles = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((f) => f.isFile())
      .map((f) => f.name)
      .sort();

    const filesByLowerName = new Map(allFiles.map((f) => [f.toLowerCase(), f]));
    const usedAsPoster = new Set();

    // Pass 1: videos (and detect their poster image, if any)
    for (const filename of allFiles) {
      const ext = path.extname(filename).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;

      const fullPath = path.join(dirPath, filename);
      const stat = fs.statSync(fullPath);
      const { base, title, tags } = parseFilename(filename);
      const poster = findPoster(base, filesByLowerName);
      if (poster) usedAsPoster.add(poster);

      items.push({
        id: `${category}/${filename}`,
        title,
        category,
        tags,
        type: "video",
        path: `assets/gallery/${category}/${filename}`,
        poster: poster ? `assets/gallery/${category}/${poster}` : null,
        date: stat.mtime.toISOString(),
      });
      videoCount++;
    }

    // Pass 2: images, skipping any consumed as a video poster
    for (const filename of allFiles) {
      const ext = path.extname(filename).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      if (usedAsPoster.has(filename)) continue;

      const fullPath = path.join(dirPath, filename);
      const stat = fs.statSync(fullPath);
      const { title, tags } = parseFilename(filename);

      items.push({
        id: `${category}/${filename}`,
        title,
        category,
        tags,
        type: "image",
        path: `assets/gallery/${category}/${filename}`,
        poster: null,
        date: stat.mtime.toISOString(),
      });
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2) + "\n");

  const imageCount = items.length - videoCount;
  console.log(
    `Wrote ${items.length} item(s) (${imageCount} image, ${videoCount} video) across ${categories.length} categor${categories.length === 1 ? "y" : "ies"} to ${path.relative(ROOT, OUTPUT_FILE)}`
  );
}

main();
