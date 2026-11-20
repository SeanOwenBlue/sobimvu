(function() {

  // ===========================================================
  // CONFIG
  // ===========================================================
  const ASSETS_BASE = "https://seanowenblue.github.io/sobimvu/assets/";
  const MANIFEST_URL = ASSETS_BASE + "data_manifest.json";   // optional (see notes)
  const SETS_URL = ASSETS_BASE + "product_sets_index.json";
  const DEVKITS_URL = ASSETS_BASE + "devkits_index.json";
  const SOCIAL_URL = ASSETS_BASE + "social_bar_data.json";
  const MAX_NUMBERED_INDEXES = 10;  // probes products_index_1.json ... products_index_10.json

  // ===========================================================
  // SHARED DATA LOADER (also used by backup_links_checker.js)
  // ===========================================================
  function fetchJson(url) {
    return fetch(url).then(r => {
      if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
      return r.json();
    });
  }

  let productsPromise = null;

  // Returns Promise<Map<productId(string), product>> merged from every products_index* file.
  // Files are searched in order; the FIRST file that contains a product ID wins.
  function loadProducts() {
    if (productsPromise) return productsPromise;

    productsPromise = (async () => {
      let files = null;

      // Preferred: explicit list of files (allows any filename containing "products_index")
      try {
        const manifest = await fetchJson(MANIFEST_URL);
        if (manifest && Array.isArray(manifest.productIndexFiles) && manifest.productIndexFiles.length) {
          files = manifest.productIndexFiles;
        }
      } catch (e) { /* no manifest: fall back to probing */ }

      // Fallback: probe products_index.json, products_index_1.json, products_index_2.json ...
      if (!files) {
        files = ["products_index.json"];
        for (let i = 1; i <= MAX_NUMBERED_INDEXES; i++) files.push(`products_index_${i}.json`);
      }

      // Fetch all in parallel; missing files (404) are simply ignored
      const results = await Promise.allSettled(files.map(f => fetchJson(ASSETS_BASE + f)));

      const map = new Map();
      results.forEach(res => {
        if (res.status !== "fulfilled" || !Array.isArray(res.value)) return;
        res.value.forEach(item => {
          const key = String(item.productId).trim();
          if (!map.has(key)) map.set(key, item);   // first match wins
        });
      });
      return map;
    })();

    return productsPromise;
  }

  window.sobData = { loadProducts, fetchJson };

  // ===========================================================
  // HEADER / FOOTER
  // ===========================================================
  const headerEl = document.getElementById('dynamic-header-content');
  if (headerEl) {
    headerEl.innerHTML = `
      <img src="https://userimages-akm.imvu.com/userdata/06/11/16/71/userpics/Snap_k6kni1AH8Z563523375.png" alt="Sean Owen Blue" style="width:400px;height:400px;">
      <h1>SEAN OWEN BLUE</h1>
    `;
  }
  const footerEl = document.getElementById('dynamic-footer-content');
  if (footerEl) {
    footerEl.innerHTML = `&#169; ${new Date().getFullYear()} Sean Owen Blue`;
  }


  // ===========================================================
  // CAROUSEL HELPER: side arrows + drag/swipe, no bottom scrollbar
  // ===========================================================
  const CAROUSEL_SELECTOR = '.img-scroll-box, .related-items-container, .devkit-scroll-box';

  function makeCarousel(box) {
    if (box.dataset.carousel) return;          // already enhanced
    box.dataset.carousel = '1';
    box.classList.add('carousel-track');

    // Wrap the box so the arrows can sit on its left/right edges
    const wrap = document.createElement('div');
    wrap.className = 'carousel';
    box.parentNode.insertBefore(wrap, box);
    wrap.appendChild(box);

    const prev = el('button', 'carousel-arrow carousel-prev', '\u2039');
    const next = el('button', 'carousel-arrow carousel-next', '\u203A');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', 'Scroll left');
    next.setAttribute('aria-label', 'Scroll right');
    wrap.appendChild(prev);
    wrap.appendChild(next);

    function updateArrows() {
      const max = box.scrollWidth - box.clientWidth;
      prev.style.display = box.scrollLeft > 2 ? 'block' : 'none';
      next.style.display = box.scrollLeft < max - 2 ? 'block' : 'none';
    }

    const step = () => Math.max(box.clientWidth * 0.8, 100);
    prev.addEventListener('click', () => box.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => box.scrollBy({ left: step(), behavior: 'smooth' }));

    box.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    box.addEventListener('load', updateArrows, true);   // images finishing loading change the width
    if (window.ResizeObserver) new ResizeObserver(updateArrows).observe(box);
    updateArrows();

    // Mouse drag-to-scroll (touch screens already swipe natively)
    let startX = 0, startScroll = 0, dragging = false, moved = false;
    box.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true; moved = false;
      startX = e.clientX; startScroll = box.scrollLeft;
    });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) { moved = true; box.classList.add('dragging'); }
      if (moved) box.scrollLeft = startScroll - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      box.classList.remove('dragging');
    });
    // If the user dragged, don't treat the release as a click on a link/button
    box.addEventListener('click', e => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  }

  function enhanceCarousels() {
    document.querySelectorAll(CAROUSEL_SELECTOR).forEach(makeCarousel);
  }

  // ===========================================================
  // PRODUCT PAGE CONTENT
  // ===========================================================
  function renderProductPage() {
    // 1. EXTRACT PRODUCT ID FROM URL
    let productId = null;
    try {
      const topUrl = new URL(window.parent.location.href);
      productId = topUrl.searchParams.get("products_id");
    } catch (e) {
      const frameUrl = new URL(window.location.href);
      productId = frameUrl.searchParams.get("products_id");
    }

    if (!productId) {
      const match = window.location.href.match(/[?&]products_id=(\d+)/);
      productId = match ? match[1] : null;
    }

    // 2. LOCATE TARGET CONTAINERS
    const mainContentContainer = document.getElementById('dynamic-main-content');
    const addContentContainer = document.getElementById('dynamic-add-content');

    if (!mainContentContainer && !addContentContainer) return;
    if (!productId) return;

    const cleanProductId = productId.trim();

    // 3. LOAD PRODUCTS (all products_index* files) + SETS
    Promise.all([
      loadProducts(),
      fetchJson(SETS_URL).catch(() => [])   // sets file is optional
    ]).then(([productMap, sets]) => {
      const product = productMap.get(cleanProductId);
      if (!product) return;

      // 4. RENDER MAIN CONTENT
      if (mainContentContainer) {
        let mainHtml = "";

        if (product.productImage) {
          mainHtml += `<div class="product-image-wrapper"><img src="${product.productImage}" class="product-main-img" alt="${product.productName || 'Product Image'}"/></div>`;
        }
        if (product.mainContent) {
          mainHtml += `<div class="main-content-text">${product.mainContent}</div>`;
        }
        if (Array.isArray(product.textures) && product.textures.length > 0) {
          mainHtml += generateImageScrollBox("Textures", product.textures);
        }
        if (Array.isArray(product.uvMaps) && product.uvMaps.length > 0) {
          mainHtml += generateImageScrollBox("UV Maps", product.uvMaps);
        }
        if (Array.isArray(product.otherMaps) && product.otherMaps.length > 0) {
          mainHtml += generateImageScrollBox("Other Maps", product.otherMaps);
        }

        mainContentContainer.innerHTML = mainHtml;
        enhanceCarousels();
      }

      // 5. RENDER ADDITIONAL CONTENT
      if (addContentContainer) {
        let addHtml = "";

        if (product.additionalContent) {
          addHtml += `<div class="add-content-text">${product.additionalContent}</div>`;
        }

        // Resolve the set definition (set takes over related items)
        const setName = product.productSet ? String(product.productSet).trim() : "";
        const set = setName
          ? (Array.isArray(sets) ? sets.find(s => String(s.setName || "").trim() === setName) : null)
          : null;

        if (setName) {
          addHtml += `<h2>${setName}</h2>`;
        }

        // Related items: set definition wins; legacy per-product list only as a fallback
        let relatedIds = [];
        if (set && Array.isArray(set.items)) {
          relatedIds = set.items;
        } else if (Array.isArray(product.relatedItems)) {
          relatedIds = product.relatedItems;
        }

        if (relatedIds.length > 0) {
          addHtml += `<h3>Related Items</h3><div class="related-items-container">`;

          relatedIds.forEach(relatedId => {
            const cleanRelatedId = String(relatedId).trim();
            const relatedProduct = productMap.get(cleanRelatedId);

            const imageSrc = (relatedProduct && relatedProduct.productImage)
              ? relatedProduct.productImage
              : `${cleanRelatedId}.png`;

            addHtml += `
              <a href="https://www.imvu.com/shop/product.php?products_id=${cleanRelatedId}" target="_blank" class="related-item-link">
                <img src="${imageSrc}" alt="Product ${cleanRelatedId}" class="related-item-img"/>
              </a>
            `;
          });

          addHtml += `</div>`;
        }

        addContentContainer.innerHTML = addHtml;
        enhanceCarousels();
      }
    }).catch(err => {
      console.error("Error loading product content JSON:", err);
    });
  }

  // Helper: horizontal image galleries (Textures, UV Maps, Other Maps)
  function generateImageScrollBox(title, imageArray) {
    const itemsHtml = imageArray.map(url => `
      <div style="width: 256px;" class="item-box">
        <img src="${url}" style="width: 256px; height: 256px;" class="img-item"/>
      </div>
    `).join("");

    return `
      <h2>${title}</h2>
      <div class="img-scroll-box">
        ${itemsHtml}
      </div>
    `;
  }

  // ===========================================================
  // DEVKITS SECTION (rendered on every page, directly above <footer>)
  // ===========================================================
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function ensureFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
    document.head.appendChild(link);
  }

  // Static intro copy shown under the "Devkits" heading
  const DEVKIT_INFO_HTML = `
    <h3>What are devkits?</h3>
    <p>A devkit (development kit) is a ready-made base package that gives creators a starting point for making new 3D items. It usually includes a template mesh, UV layouts, and reference textures that already match the platform's skeleton and sizing. Using one means your creations fit and deform correctly without rebuilding the base from scratch.</p>

    <h3>How to use 2D devkits?</h3>
    <p>2D devkits are used by editing the source images listed in a product's description with image-editing software such as GIMP or Photoshop. Paint over or replace those textures to create your own designs for clothing, accessories, and more.</p>

    <h3>How to use 3D devkits?</h3>
    <p>3D devkits provide source 3D files that you can open in programs like Blender, Marvelous Designer, or Substance Painter to create rigged or unrigged items compatible with the devkit, such as clothing and accessories. <a href="https://www.youtube.com/watch?v=eWg04v-Sf74" target="_blank" rel="noopener">Watch this tutorial</a> to see one in use.</p>

    <h3>Physics supported or not supported?</h3>
    <p>Physics-supported devkits let you make items that respond accurately to physics-based deformation in the glute and pec areas. <a href="https://www.youtube.com/watch?v=tzpLGawAjsI" target="_blank" rel="noopener">Learn how to make physics-based items in 3D</a> with this tutorial.</p>
  `;

  function renderDevkits() {
    const footer = document.querySelector('footer');
    if (!footer) return;

    Promise.all([
      fetchJson(DEVKITS_URL),
      loadProducts()
    ]).then(([devkits, productMap]) => {
      if (!Array.isArray(devkits) || devkits.length === 0) return;

      ensureFontAwesome();

      const section = el('section', 'devkits-section');
      section.id = 'devkits-section';
      section.appendChild(el('h2', null, 'Devkits'));

      // ---- Intro / how-to copy ----
      const info = el('div', 'devkit-info');
      info.innerHTML = DEVKIT_INFO_HTML;
      section.appendChild(info);

      // ---- Devkit cards scrollbox ----
      const scrollBox = el('div', 'devkit-scroll-box');
      section.appendChild(scrollBox);

      // ---- Shared items panel (hidden until a 2D/3D items button is clicked) ----
      const panel = el('div', 'devkit-items-panel');
      panel.style.display = 'none';

      // "Download the Devkit" button (3D mode only)
      const downloadWrap = el('div', 'devkit-download-wrap');
      const downloadBtn = el('button', 'devkit-download-btn', 'Download the Devkit');
      downloadBtn.type = 'button';
      downloadBtn.addEventListener('click', () => {
        if (activeIndex === null) return;
        const link = devkits[activeIndex].devkit3dLink;
        if (link) window.open(link, '_blank', 'noopener');
      });
      downloadWrap.appendChild(downloadBtn);
      downloadWrap.style.display = 'none';

      const panelHeader = el('div', 'devkit-items-header');
      const panelTitle = el('h3', 'devkit-items-title');
      const search = document.createElement('input');
      search.type = 'search';
      search.placeholder = 'Search items...';
      search.className = 'devkit-items-search';
      panelHeader.appendChild(panelTitle);
      panelHeader.appendChild(search);

      const grid = el('div', 'devkit-items-grid');
      panel.appendChild(downloadWrap);
      panel.appendChild(panelHeader);
      panel.appendChild(grid);
      section.appendChild(panel);

      let activeIndex = null;
      let activeMode = null;          // '2d' | '3d'
      const buttons2d = [];
      const buttons3d = [];

      // Accepts devkit3dItems (canonical) or devkit3DItems
      function getItems(devkit, mode) {
        const list = mode === '3d'
          ? (devkit.devkit3dItems || devkit.devkit3DItems)
          : devkit.devkit2dItems;
        return Array.isArray(list) ? list : [];
      }

      function renderItems() {
        grid.innerHTML = '';
        if (activeIndex === null) return;

        const query = search.value.trim().toLowerCase();
        const ids = getItems(devkits[activeIndex], activeMode);
        let shown = 0;

        if (ids.length === 0) {
          grid.appendChild(el('p', 'devkit-items-empty', 'No base items listed yet.'));
          return;
        }

        ids.forEach(rawId => {
          const id = String(rawId).trim();
          const product = productMap.get(id);
          const name = product && product.productName ? product.productName : `Product ${id}`;

          if (query && !(name.toLowerCase().includes(query) || id.includes(query))) return;
          shown++;

          const link = el('a', 'devkit-item');
          link.href = `https://www.imvu.com/shop/product.php?products_id=${id}`;
          link.target = '_blank';
          link.title = name;

          const preview = el('div', 'devkit-item-preview');
          if (product && product.productImage) {
            const img = document.createElement('img');
            img.src = product.productImage;
            img.alt = name;
            preview.appendChild(img);
          } else {
            preview.appendChild(el('i', 'fa-solid fa-shirt'));
          }

          link.appendChild(preview);
          link.appendChild(el('span', 'devkit-item-name', name));
          grid.appendChild(link);
        });

        if (shown === 0) {
          grid.appendChild(el('p', 'devkit-items-empty', 'No items found.'));
        }
      }

      // Click same button again -> close; click the other mode/card -> swap
      function togglePanel(index, mode) {
        if (activeIndex === index && activeMode === mode) {
          activeIndex = null;
          activeMode = null;
          panel.style.display = 'none';
        } else {
          activeIndex = index;
          activeMode = mode;
          search.value = '';
          panelTitle.textContent = `${devkits[index].name || 'Devkit'} - ${mode.toUpperCase()} Items`;
          downloadWrap.style.display = (mode === '3d' && devkits[index].devkit3dLink) ? 'block' : 'none';
          panel.style.display = 'block';
          panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        buttons2d.forEach((b, i) => b && b.classList.toggle('active', i === activeIndex && activeMode === '2d'));
        buttons3d.forEach((b, i) => b && b.classList.toggle('active', i === activeIndex && activeMode === '3d'));
        renderItems();
      }

      search.addEventListener('input', renderItems);

      // ---- Build each card ----
      devkits.forEach((devkit, index) => {
        const card = el('div', 'devkit-card');

        if (devkit.image) {
          const img = document.createElement('img');
          img.src = devkit.image;
          img.alt = devkit.name || 'Devkit';
          img.className = 'devkit-card-img';
          card.appendChild(img);
        }

        card.appendChild(el('h3', 'devkit-card-name', devkit.name || 'Untitled Devkit'));
        card.appendChild(el('p', 'devkit-card-desc', devkit.description || ''));

        // 3D button -> opens the 3D base-items panel (download button sits at its top)
        const btn3d = el('button', 'devkit-btn', '3D Devkit Items');
        btn3d.type = 'button';
        btn3d.title = 'For 3D mesh creation';
        if (getItems(devkit, '3d').length > 0 || devkit.devkit3dLink) {
          btn3d.addEventListener('click', () => togglePanel(index, '3d'));
        } else {
          btn3d.disabled = true;
        }
        buttons3d[index] = btn3d;
        card.appendChild(btn3d);

        // 2D button -> opens the 2D items panel
        const btn2d = el('button', 'devkit-btn', '2D Devkit Items');
        btn2d.type = 'button';
        btn2d.title = 'For texture-based creation';
        if (getItems(devkit, '2d').length > 0) {
          btn2d.addEventListener('click', () => togglePanel(index, '2d'));
        } else {
          btn2d.disabled = true;
        }
        buttons2d[index] = btn2d;
        card.appendChild(btn2d);

        // Physics verification
        card.appendChild(el(
          'p',
          devkit.supportsPhysics ? 'success' : 'warning',
          devkit.supportsPhysics ? 'Physics supported.' : 'No physics supported.'
        ));

        scrollBox.appendChild(card);
      });

      footer.parentNode.insertBefore(section, footer);
      enhanceCarousels();
    }).catch(err => {
      console.error("Error loading devkits:", err);
    });
  }

  // ===========================================================
  // SOCIAL BAR (inside <footer>, above the copyright line)
  // ===========================================================
  function renderSocialBar() {
    const footer = document.querySelector('footer');
    if (!footer) return;

    fetchJson(SOCIAL_URL).then(links => {
      if (!Array.isArray(links) || links.length === 0) return;

      ensureFontAwesome();

      const bar = el('div', 'social-bar');
      bar.id = 'social-bar';

      links.forEach(item => {
        if (!item || !item.url) return;
        const a = el('a', 'social-link');
        a.href = item.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.title = item.name || '';
        a.setAttribute('aria-label', item.name || 'Social link');
        a.appendChild(el('i', item.logo || 'fa-solid fa-link'));
        bar.appendChild(a);
      });

      if (!bar.children.length) return;

      const copyright = document.getElementById('dynamic-footer-content');
      if (copyright && footer.contains(copyright)) {
        copyright.parentNode.insertBefore(bar, copyright);
      } else {
        footer.insertBefore(bar, footer.firstChild);
      }
    }).catch(err => {
      console.error("Error loading social bar:", err);
    });
  }

  // ===========================================================
  // RUN
  // ===========================================================
  renderProductPage();
  renderDevkits();
  renderSocialBar();
})();
