// Reusable grid + slider lightbox for a fixed, hand-picked list of items
// (e.g. a case-study "drafts" or "reviews" section) — no filtering, no
// sorting, no same-name grouping. Every item gets its own tile, and the
// lightbox pages through the full list via arrows/keyboard. Mirrors the
// lightbox UX in js/gallery.js so it looks and behaves the same, but stays
// independent so gallery.html's filter/sort/grouping logic is never at risk
// of being touched by case-study pages.
//
// Usage:
//   initSimpleGallery({
//     grid: document.getElementById("drafts-grid"),
//     lightbox: document.getElementById("drafts-lightbox"),
//     items: [{ path, title, category, type, poster }],
//   });
function initSimpleGallery({ grid, lightbox, items }) {
  const lightboxImg = lightbox.querySelector("img");
  const lightboxVideo = lightbox.querySelector("video");
  const lightboxTitle = lightbox.querySelector(".lightbox-meta h3");
  const lightboxCat = lightbox.querySelector(".lightbox-meta span");
  const lightboxCounter = lightbox.querySelector(".lightbox-counter");
  const prevBtn = lightbox.querySelector(".lightbox-nav.prev");
  const nextBtn = lightbox.querySelector(".lightbox-nav.next");

  let currentIndex = 0;

  function mediaThumb(item) {
    if (item.type === "video") {
      const posterAttr = item.poster ? ` poster="${item.poster}"` : "";
      return `<video class="thumb-media" src="${item.path}"${posterAttr} title="${item.title || ""}" muted loop playsinline preload="metadata"></video>
        <span class="play-badge">&#9654;</span>`;
    }
    return `<img src="${item.path}" alt="${item.title || ""}" title="${item.title || ""}" loading="lazy">`;
  }

  grid.innerHTML = items
    .map(
      (item, idx) => `
    <article class="panel gallery-item" style="animation-delay:${Math.min(idx * 0.03, 0.4)}s" aria-label="${item.title || ""}">
      <div class="thumb-wrap">${mediaThumb(item)}</div>
    </article>`
    )
    .join("");

  grid.querySelectorAll(".gallery-item").forEach((el, i) => {
    el.addEventListener("click", () => openLightbox(i));
    if (items[i].type === "video") {
      const vid = el.querySelector("video");
      el.addEventListener("mouseenter", () => vid.play().catch(() => {}));
      el.addEventListener("mouseleave", () => {
        vid.pause();
        vid.currentTime = 0;
      });
    }
  });

  function showSlide(index) {
    const len = items.length;
    if (!len) return;
    currentIndex = ((index % len) + len) % len;
    const item = items[currentIndex];

    lightboxTitle.textContent = item.title || "";
    lightboxCat.textContent = item.category || "";
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
      lightboxImg.alt = item.title || "";
    }
  }

  function openLightbox(index) {
    showSlide(index);
    lightbox.classList.add("open");
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
    lightboxVideo.pause();
  }

  function navigate(delta) {
    showSlide(currentIndex + delta);
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
}
