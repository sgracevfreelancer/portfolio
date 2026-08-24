// Gallery page: loads data/gallery.json (produced by scripts/build-gallery.js
// from the assets/gallery/<Category>/ folders) and renders a filterable,
// sortable grid + lightbox. Drop new images or videos into a category
// folder, rebuild the JSON (see README), and this page picks them up
// automatically — no HTML editing required.
//
// Grouping: images whose filename ends in a number (e.g. Bottle_1.png,
// Bottle_2.png) are collapsed into a single grid tile. Hovering that tile
// cycles through the group's images; clicking opens the lightbox on
// whichever image was showing. The lightbox itself is a slider over every
// item in the current filtered/sorted view — arrow keys or the on-screen
// arrows move to the next/previous item regardless of grouping.

(function () {
  const grid = document.getElementById("gallery-grid");
  const pillsWrap = document.getElementById("filter-pills");
  const sortSelect = document.getElementById("sort-select");
  const countEl = document.getElementById("gallery-count");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = lightbox.querySelector("img");
  const lightboxVideo = lightbox.querySelector("video");
  const lightboxTitle = lightbox.querySelector(".lightbox-meta h3");
  const lightboxCat = lightbox.querySelector(".lightbox-meta span");
  const lightboxCounter = lightbox.querySelector(".lightbox-counter");
  const prevBtn = lightbox.querySelector(".lightbox-nav.prev");
  const nextBtn = lightbox.querySelector(".lightbox-nav.next");

  const GROUP_CYCLE_MS = 900;

  let items = [];
  let activeCategory = "All";
  let sortMode = "newest";

  // The flat, filtered + sorted list backing the lightbox slider. Grouping
  // only affects how the grid renders — the slider still steps through
  // every individual item in this list.
  let currentFiltered = [];
  let currentIndex = 0;

  function formatCategory(dir) {
    return dir.replace(/[-_]/g, " ");
  }

  // "Bottle 1" -> { base: "Bottle", n: 1 }. Titles come pre-normalized
  // (underscores/dashes already turned into spaces) by build-gallery.js.
  function parseGroupTitle(title) {
    const m = title.match(/^(.*?)\s+(\d+)$/);
    if (!m) return null;
    return { base: m[1].trim(), n: parseInt(m[2], 10) };
  }

  // Collapses consecutive same-base-name image items (within a category)
  // into group entries for grid rendering. Groups of size 1 fall back to
  // a plain single entry.
  function buildGridEntries(list) {
    const buckets = new Map();
    const order = [];

    list.forEach((item) => {
      const g = item.type === "image" ? parseGroupTitle(item.title) : null;
      if (!g) {
        order.push({ kind: "single", item });
        return;
      }
      const key = item.category + "|" + g.base;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { kind: "group", entries: [] };
        buckets.set(key, bucket);
        order.push(bucket);
      }
      bucket.entries.push({ item, n: g.n });
    });

    return order.map((entry) => {
      if (entry.kind === "single") return entry;
      if (entry.entries.length < 2) {
        return { kind: "single", item: entry.entries[0].item };
      }
      entry.entries.sort((a, b) => a.n - b.n);
      return { kind: "group", items: entry.entries.map((e) => e.item) };
    });
  }

  function mediaThumb(item) {
    if (item.type === "video") {
      const posterAttr = item.poster ? ` poster="${item.poster}"` : "";
      return `<video class="thumb-media" src="${item.path}"${posterAttr} title="${item.title}" muted loop playsinline preload="metadata"></video>
        <span class="play-badge">&#9654;</span>`;
    }
    return `<img src="${item.path}" alt="${item.title}" title="${item.title}" loading="lazy">`;
  }

  function render() {
    let filtered =
      activeCategory === "All"
        ? [...items]
        : items.filter((i) => i.category === activeCategory);

    filtered.sort((a, b) => {
      switch (sortMode) {
        case "oldest":
          return new Date(a.date) - new Date(b.date);
        case "name-asc":
          return a.title.localeCompare(b.title);
        case "name-desc":
          return b.title.localeCompare(a.title);
        case "category":
          return a.category.localeCompare(b.category) || a.title.localeCompare(b.title);
        case "newest":
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

    currentFiltered = filtered;

    countEl.textContent = `${filtered.length} piece${filtered.length === 1 ? "" : "s"}${
      activeCategory === "All" ? "" : ` in ${formatCategory(activeCategory)}`
    }`;

    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state">No pieces here yet — drop images or videos into <code>assets/gallery/${
        activeCategory === "All" ? "&lt;Category&gt;" : activeCategory
      }/</code> and rebuild the gallery.</div>`;
      return;
    }

    const entries = buildGridEntries(filtered);

    grid.innerHTML = entries
      .map((entry, idx) => {
        const delay = `style="animation-delay:${Math.min(idx * 0.04, 0.4)}s"`;
        if (entry.kind === "single") {
          return `
      <article class="panel gallery-item" ${delay} aria-label="${entry.item.title}">
        <div class="thumb-wrap">${mediaThumb(entry.item)}</div>
      </article>`;
        }
        const primary = entry.items[0];
        return `
      <article class="panel gallery-item is-group" ${delay} aria-label="${primary.title}">
        <div class="thumb-wrap">
          <img src="${primary.path}" alt="${primary.title}" title="${primary.title}" loading="lazy">
          <span class="stack-badge">1/${entry.items.length}</span>
        </div>
      </article>`;
      })
      .join("");

    grid.querySelectorAll(".gallery-item").forEach((el, i) => {
      const entry = entries[i];

      if (entry.kind === "single") {
        const item = entry.item;
        el.addEventListener("click", () => openLightbox(filtered.indexOf(item)));
        if (item.type === "video") {
          const vid = el.querySelector("video");
          el.addEventListener("mouseenter", () => vid.play().catch(() => {}));
          el.addEventListener("mouseleave", () => {
            vid.pause();
            vid.currentTime = 0;
          });
        }
        return;
      }

      // Grouped tile: hover cycles the thumbnail through every image in
      // the group; clicking opens the lightbox on whichever one is shown.
      const imgEl = el.querySelector("img");
      const badgeEl = el.querySelector(".stack-badge");
      const groupItems = entry.items;
      let shownIdx = 0;
      let cycleTimer = null;

      function showGroupIndex(i) {
        shownIdx = i;
        imgEl.src = groupItems[shownIdx].path;
        imgEl.alt = groupItems[shownIdx].title;
        badgeEl.textContent = `${shownIdx + 1}/${groupItems.length}`;
      }

      el.addEventListener("mouseenter", () => {
        showGroupIndex(1 % groupItems.length);
        cycleTimer = setInterval(() => {
          showGroupIndex((shownIdx + 1) % groupItems.length);
        }, GROUP_CYCLE_MS);
      });
      el.addEventListener("mouseleave", () => {
        clearInterval(cycleTimer);
        showGroupIndex(0);
      });
      el.addEventListener("click", () => {
        openLightbox(filtered.indexOf(groupItems[shownIdx]));
      });
    });
  }

  function renderPills() {
    const categories = ["All", ...new Set(items.map((i) => i.category))].sort((a, b) =>
      a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b)
    );
    pillsWrap.innerHTML = categories
      .map(
        (c) =>
          `<button class="filter-pill${c === activeCategory ? " active" : ""}" data-cat="${c}">${
            c === "All" ? "All" : formatCategory(c)
          }</button>`
      )
      .join("");
    pillsWrap.querySelectorAll(".filter-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeCategory = btn.dataset.cat;
        pillsWrap.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        render();
      });
    });
  }

  // ---------- lightbox slider ----------
  // Steps through currentFiltered (every item in the active filter/sort,
  // ungrouped) regardless of how the grid collapsed items into groups.

  function showSlide(index) {
    const len = currentFiltered.length;
    if (!len) return;
    currentIndex = ((index % len) + len) % len;
    const item = currentFiltered[currentIndex];

    lightboxTitle.textContent = item.title;
    lightboxCat.textContent = formatCategory(item.category);
    lightboxCounter.textContent = `${currentIndex + 1} / ${len}`;

    const showNav = len > 1;
    prevBtn.hidden = !showNav;
    nextBtn.hidden = !showNav;

    if (item.type === "video") {
      lightboxImg.style.display = "none";
      lightboxImg.src = "";
      lightboxVideo.style.display = "block";
      lightboxVideo.src = item.path;
      if (item.poster) lightboxVideo.poster = item.poster;
      else lightboxVideo.removeAttribute("poster");
      lightboxVideo.currentTime = 0;
      lightboxVideo.play().catch(() => {});
    } else {
      lightboxVideo.style.display = "none";
      lightboxVideo.pause();
      lightboxVideo.removeAttribute("src");
      lightboxVideo.load();
      lightboxImg.style.display = "block";
      lightboxImg.src = item.path;
      lightboxImg.alt = item.title;
    }
  }

  function openLightbox(index) {
    showSlide(index);
    lightbox.classList.add("open");
  }

  function navigate(delta) {
    showSlide(currentIndex + delta);
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightboxVideo.pause();
  }

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox || e.target.classList.contains("lightbox-close")) {
      closeLightbox();
    }
  });
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigate(-1);
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigate(1);
  });
  document.addEventListener("keydown", (e) => {
    if (!lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") navigate(-1);
    if (e.key === "ArrowRight") navigate(1);
  });

  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    render();
  });

  function boot() {
    fetch("data/gallery.json")
      .then((r) => r.json())
      .then((data) => {
        items = data;
        renderPills();
        render();
      })
      .catch(() => {
        grid.innerHTML = `<div class="empty-state">Couldn't load <code>data/gallery.json</code>. Run <code>npm run build:gallery</code> to generate it.</div>`;
      });
  }

  // Wait for the password gate (js/auth-gate.js) before fetching/rendering
  // anything, so the gallery data never populates the DOM while locked.
  if (document.body.classList.contains("locked")) {
    window.addEventListener("site:unlocked", boot, { once: true });
  } else {
    boot();
  }
})();
