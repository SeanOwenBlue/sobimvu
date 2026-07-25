(function() {
	
  document.getElementById('dynamic-header-content').innerHTML =`
    <img src="https://userimages-akm.imvu.com/userdata/06/11/16/71/userpics/Snap_k6kni1AH8Z563523375.png" alt="Sean Owen Blue" style="width:400px;height:400px;">
        <h1>SEAN OWEN BLUE</h1>
    `;
  document.getElementById('dynamic-footer-content').innerHTML = `&#169 ${new Date().getFullYear()} Sean Owen Blue`;

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

  // If neither target element exists on page, stop execution
  if (!mainContentContainer && !addContentContainer) return;

  if (!productId) return;

  const cleanProductId = productId.trim();
  const jsonUrl = "https://seanowenblue.github.io/sobimvu/assets/products_index.json";

  // 3. FETCH JSON & RENDER CONTENT
  fetch(jsonUrl)
    .then(response => response.json())
    .then(data => {
      if (!Array.isArray(data)) return;

      // Find current product in array
      const product = data.find(item => String(item.productId) === cleanProductId);
      if (!product) return;

      // Map array of all products for quick lookup of related items
      const productMap = new Map(data.map(item => [String(item.productId), item]));

      // 4. RENDER MAIN CONTENT
      if (mainContentContainer) {
        let mainHtml = "";

        // Product Image
        if (product.productImage) {
          mainHtml += `<div class="product-image-wrapper"><img src="${product.productImage}" class="product-main-img" alt="${product.productName || 'Product Image'}"/></div>`;
        }

        // Main Description / Content
        if (product.mainContent) {
          mainHtml += `<div class="main-content-text">${product.mainContent}</div>`;
        }

        // Textures
        if (Array.isArray(product.textures) && product.textures.length > 0) {
          mainHtml += generateImageScrollBox("Textures", product.textures);
        }

        // UV Maps
        if (Array.isArray(product.uvMaps) && product.uvMaps.length > 0) {
          mainHtml += generateImageScrollBox("UV Maps", product.uvMaps);
        }

        // Other Maps
        if (Array.isArray(product.otherMaps) && product.otherMaps.length > 0) {
          mainHtml += generateImageScrollBox("Other Maps", product.otherMaps);
        }

        mainContentContainer.innerHTML = mainHtml;
      }

      // 5. RENDER ADDITIONAL CONTENT
      if (addContentContainer) {
        let addHtml = "";

        // Additional Content Text
        if (product.additionalContent) {
          addHtml += `<div class="add-content-text">${product.additionalContent}</div>`;
        }

        // Product Set Title
        if (product.productSet) {
          addHtml += `<h2>${product.productSet}</h2>`;
        }

        // Related Items
        if (Array.isArray(product.relatedItems) && product.relatedItems.length > 0) {
          addHtml += `<h3>Related Items</h3><div class="related-items-container">`;

          product.relatedItems.forEach(relatedId => {
            const cleanRelatedId = String(relatedId).trim();
            const relatedProduct = productMap.get(cleanRelatedId);
            
            // Use the related item's image, or fallback to standard product icon format
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
    })
    .catch(err => {
      console.error("Error loading product content JSON:", err);
    });

  // Helper function to build horizontal image galleries (Textures, UV Maps, Other Maps)
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
})();
