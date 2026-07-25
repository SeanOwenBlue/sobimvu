// Google Drive & Backup Links Check
(function() {
  // 1. EXTRACT PRODUCT ID FIRST
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

  // 2. CHECK TARGET CONTAINER EXISTENCE
  const widgetContainer = document.getElementById('backup-links-target');
  if (!widgetContainer) return;

  const jsonUrl = "https://seanowenblue.github.io/sobimvu/assets/products_index.json";
  const defaultFallbackUrl = "https://drive.google.com/drive/folders/1VFWVQGVfbEKE5mvQINWUNVe6IhwOl2FI?usp=sharing";

  if (!productId) {
    // Fallback display when no Product ID is parsed
    renderLayout(widgetContainer, {
      title: "Product Assets",
      linkText: "Main Google Drive Directory",
      linkUrl: defaultFallbackUrl,
      displayId: "Not Found",
      showStatus: true,
      mirrorLinks: []
    });
    return;
  }

  const cleanProductId = productId.trim();

  // 3. FETCH AND PROCESS JSON DATA
  fetch(jsonUrl)
    .then(response => response.json())
    .then(data => {
      // Find matching product by ID (handling numerical or string representation)
      const product = Array.isArray(data) 
        ? data.find(item => String(item.productId) === cleanProductId)
        : null;

      const useBackups = product ? Boolean(product.useBackups) : false;
      const gdriveLink = product && product.googleDriveLink ? product.googleDriveLink.trim() : null;
      const mirrorLinks = product && Array.isArray(product.mirrorLinks) ? product.mirrorLinks.filter(Boolean) : [];

      // Check if Google Drive link fails/is missing
      const hasGdriveLink = Boolean(gdriveLink);
      const hasMirrorLinks = mirrorLinks.length > 0;

      // HIDE CONDITION: IF useBackups is FALSE AND Google Drive link fails AND no mirror links
      if (!useBackups && !hasGdriveLink && !hasMirrorLinks) {
        widgetContainer.style.display = 'none';
        return;
      }

      // Determine HTML Headers & Content based on 'useBackups'
      const title = useBackups ? "Product Assets" : "Backup Assets";
      const leadText = useBackups 
        ? "View product assets here:" 
        : "Missing resources? Find backups resources here:";

      const linkUrl = hasGdriveLink ? gdriveLink : defaultFallbackUrl;
      const linkText = hasGdriveLink ? `Google Drive Folder ${cleanProductId}` : "Main Google Drive Directory";

      // Render the structure
      renderLayout(widgetContainer, {
        title,
        leadText,
        linkText,
        linkUrl,
        displayId: cleanProductId,
        showStatus: !hasGdriveLink, // Hide search helper text if direct link exists
        mirrorLinks
      });
    })
    .catch(err => {
      console.error("JSON fetch error:", err);
      
      // Default fallback layout if network/JSON fetch fails
      renderLayout(widgetContainer, {
        title: "Product Assets",
        leadText: "View product assets here:",
        linkText: "Main Google Drive Directory",
        linkUrl: defaultFallbackUrl,
        displayId: cleanProductId,
        showStatus: true,
        mirrorLinks: []
      });
    });

  // Helper function to build dynamic HTML string
  function renderLayout(container, options) {
    const {
      title,
      leadText = "View product assets here:",
      linkText,
      linkUrl,
      displayId,
      showStatus,
      mirrorLinks = []
    } = options;

    let mirrorLinksHTML = "";
    if (mirrorLinks.length > 0) {
      const linksList = mirrorLinks
        .map((url, idx) => `<a href="${url}" target="_blank" class="mirror-link">Mirror ${idx + 1}</a>`)
        .join(" | ");
      mirrorLinksHTML = `<br><div class="mirror-links-wrapper"><strong>Alternative Mirrors:</strong> ${linksList}</div>`;
    }

    let statusHTML = "";
    if (showStatus) {
      statusHTML = `<span id="gdrive-search-status">Search for the product ID: <strong>${displayId}</strong><br>If not found, please send a message.</span>`;
    }

    container.innerHTML = `
      <h2>${title}</h2>
      <div class="gdrive-container">
        <p>${leadText} <a id="dynamic-gdrive-link" href="${linkUrl}" target="_blank">${linkText}</a></p><br>
        ${statusHTML}
        ${mirrorLinksHTML}
      </div>
    `;
  }
})();
