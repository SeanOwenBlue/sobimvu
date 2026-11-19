(function() {

  // ===========================================================
  // CONFIG
  // ===========================================================
  const ASSETS_BASE = "https://seanowenblue.github.io/sobimvu/assets/";
  const MANIFEST_URL = ASSETS_BASE + "data_manifest.json";   // optional (see notes)
  const SETS_URL = ASSETS_BASE + "product_sets_index.json";
  const DEVKITS_URL = ASSETS_BASE + "devkits_index.json";
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

      // ---- Devkit cards scrollbox ----
      const scrollBox = el('div', 'devkit-scroll-box');
      section.appendChild(scrollBox);

      // ---- 2D items panel (hidden until a 2D button is clicked) ----
      const panel = el('div', 'devkit-items-panel');
      panel.style.display = 'none';

      const panelHeader = el('div', 'devkit-items-header');
      const panelTitle = el('h3', 'devkit-items-title');
      const search = document.createElement('input');
      search.type = 'search';
      search.placeholder = 'Search items...';
      search.className = 'devkit-items-search';
      panelHeader.appendChild(panelTitle);
      panelHeader.appendChild(search);

      const grid = el('div', 'devkit-items-grid');
      panel.appendChild(panelHeader);
      panel.appendChild(grid);
      section.appendChild(panel);

      let activeIndex = null;
      const buttons2d = [];

      function renderItems() {
        grid.innerHTML = '';
        if (activeIndex === null) return;

        const query = search.value.trim().toLowerCase();
        const ids = Array.isArray(devkits[activeIndex].devkit2dItems) ? devkits[activeIndex].devkit2dItems : [];
        let shown = 0;

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
            const icon = el('i', 'fa-solid fa-shirt');
            preview.appendChild(icon);
          }

          link.appendChild(preview);
          link.appendChild(el('span', 'devkit-item-name', name));
          grid.appendChild(link);
        });

        if (shown === 0) {
          grid.appendChild(el('p', 'devkit-items-empty', 'No items found.'));
        }
      }

      function toggle2dPanel(index) {
        if (activeIndex === index) {
          activeIndex = null;
          panel.style.display = 'none';
        } else {
          activeIndex = index;
          search.value = '';
          panelTitle.textContent = `${devkits[index].name || 'Devkit'} - 2D Items`;
          panel.style.display = 'block';
        }
        buttons2d.forEach((b, i) => b.classList.toggle('active', i === activeIndex));
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

        // 3D devkit button -> opens link in new tab
        const btn3d = el('button', 'devkit-btn', '3D Devkit');
        btn3d.type = 'button';
        btn3d.title = 'For 3D mesh creation';
        if (devkit.devkit3dLink) {
          btn3d.addEventListener('click', () => window.open(devkit.devkit3dLink, '_blank', 'noopener'));
        } else {
          btn3d.disabled = true;
        }
        card.appendChild(btn3d);

        // 2D devkit items button -> toggles items panel
        const btn2d = el('button', 'devkit-btn', '2D Devkit Items');
        btn2d.type = 'button';
        btn2d.title = 'For texture-based creation';
        if (Array.isArray(devkit.devkit2dItems) && devkit.devkit2dItems.length > 0) {
          btn2d.addEventListener('click', () => toggle2dPanel(index));
        } else {
          btn2d.disabled = true;
        }
        buttons2d[index] = btn2d;
        card.appendChild(btn2d);

        // Physics warning
        card.appendChild(el(
          'p', 'warning',
          devkit.supportsPhysics ? 'This devkit does support physics' : 'This devkit does not support physics'
        ));

        scrollBox.appendChild(card);
      });

      footer.parentNode.insertBefore(section, footer);
    }).catch(err => {
      console.error("Error loading devkits:", err);
    });
  }

  // ===========================================================
  // RUN
  // ===========================================================
  renderProductPage();
  renderDevkits();
})();
