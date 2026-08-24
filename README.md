# Shay V — Portfolio

Neo-brutalist portfolio site with a self-updating gallery.

## Structure

```
index.html              Home page (hero, about, skills, experience, featured work, contact)
gallery.html            Full gallery — filter by category, sort by date/name
css/style.css           Design system (brutalist tokens, panels, layout)
js/main.js              Shared nav + scroll behavior
js/gallery.js           Gallery rendering, filtering, sorting, lightbox
assets/gallery/         Portfolio images and videos, organized by category folder
data/gallery.json       Auto-generated — do not edit by hand
scripts/build-gallery.js  Scans assets/gallery/ and writes data/gallery.json
scripts/watch-gallery.js Watches assets/gallery/ and reruns build-gallery.js automatically
```

## Updating the gallery

1. Drop image **or video** files into a folder under `assets/gallery/`. Each folder
   name becomes a filter category on the gallery page (e.g.
   `assets/gallery/Branding/logo-v1.png` → category "Branding").
2. Create a new folder for a new category any time — no code changes needed.
3. Rebuild the gallery data — either once:
   ```
   npm run build:gallery
   ```
   or leave it running and it rebuilds automatically every time you add,
   remove, or rename a file:
   ```
   npm run watch:gallery
   ```
   (`npm run dev` runs the watcher and the local server together, so you can
   just drop files in and refresh the browser tab.)
4. Refresh the page. The title is generated from the filename
   (`brand-identity-mark.png` → "Brand Identity Mark").

**Grouping:** images with the same base name and a trailing number —
`Bottle_1.png`, `Bottle_2.png`, `Bottle_3.png` — collapse into a single grid
tile. Hovering cycles the thumbnail through the group in order; the lightbox
still lets you page through every individual item via the arrow keys.

**Video support:** `.mp4`, `.webm`, `.mov`, `.m4v` all work. Videos autoplay
muted on hover in the grid and play with sound in the lightbox on click. To
set a custom thumbnail instead of the video's first frame, add a matching
image file with a `-Cover` (or `-poster`) suffix next to it:
```
assets/gallery/Video-Motion/Weekly-Recap.mp4
assets/gallery/Video-Motion/Weekly-Recap-Cover.jpg   <- used as its poster, not listed separately
```

**Optional tags:** name a file `My Title__tag1,tag2.jpg` (double underscore) to
attach tags in the JSON for future use, without affecting the visible title.

**Auto-rebuild on GitHub:** `.github/workflows/build-gallery.yml` reruns the
build script and commits the refreshed `gallery.json` automatically whenever
you push changes to `assets/gallery/`. If commits from Actions are blocked,
enable *Settings → Actions → General → Workflow permissions → Read and write*.

## Fonts

Unbounded (display headlines), Archivo (body copy), and Space Mono (nav,
labels, badges, buttons) — loaded from Google Fonts in both HTML files.

## Running locally

**Don't open `index.html` by double-clicking it.** Browsers block `fetch()`
requests from `file://` pages, so the gallery will fail to load with
"Couldn't load `data/gallery.json`" even though the file exists — this is a
browser security restriction, not a bug, and it goes away once the site is
served over `http://` or `https://` (which is exactly how GitHub Pages will
serve it in production).

Serve the folder locally instead:
```
npm start
```
This runs a static file server (via `npx serve`) and prints a local URL like
`http://localhost:3000` — open that instead of the file directly. Any other
static server works too, e.g. `python3 -m http.server`.
