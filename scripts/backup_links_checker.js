// Google Drive Check
(function() {
  // 1. EXTRACT PRODUCT ID FIRST (Moved to top)
  let productId = null;
  try {
    const topUrl = new URL(window.parent.location.href);
    productId = topUrl.searchParams.get("products_id");
  } catch (e) {
    const frameUrl = new URL(window.location.href);
    productId = frameUrl.searchParams.get("products_id");
  }

  if (!productId) {
    // FIX: Restored \\d+ regex parameter rule to track numerical strings
    const match = window.location.href.match(/[?&]products_id=(\d+)/);
    productId = match ? match[1] : null;
  }

  // 2. CHECK TARGET CONTAINER EXISTENCE
  const widgetContainer = document.getElementById('backup-links-target');
  if (!widgetContainer) return;

  // Clean string text for presentation
  const displayId = productId ? productId.trim() : "Not Found";

  // 3. INJECT THE LAYOUT TEMPLATE (Safely uses displayId now)
  widgetContainer.innerHTML = `
    <h2>Product Assets</h2>
    <div class="gdrive-container">
      <p>View product assets here: <a id="dynamic-gdrive-link" href="#" target="_blank">Loading folder...</a></p><br>
      Search for the product ID: <strong>${displayId}</strong>
    </div>
  `;

  const linkElement = document.getElementById('dynamic-gdrive-link');
  const csvUrl = "https://seanowenblue.github.io/sobimvu/products_index.csv";

  // 4. FETCH AND PROCESS CSV DATABASE MATCHES
  if (productId && linkElement) {
    productId = productId.trim();

    fetch(csvUrl)
      .then(response => response.text())
      .then(text => {
        const cleanText = text.replace(/\r/g, "");
        const lines = cleanText.split("\n");
        let foundLink = null;

        for (let line of lines) {
          if (!line.trim()) continue;
          
          const columns = line.split(",");
          const currentColumnId = columns[0] ? columns[0].trim() : "";
          
          // Bulletproof partial containment check
          if (columns.length > 1 && currentColumnId.includes(productId)) {
            foundLink = columns[1] ? columns[1].trim() : null;
            break;
          }
        }

        if (foundLink) {
          linkElement.href = foundLink;
          linkElement.textContent = "Google Drive Folder " + productId;
        } else {
          // Default directory fallback
          linkElement.href = "https://drive.google.com/drive/folders/1VFWVQGVfbEKE5mvQINWUNVe6IhwOl2FI?usp=sharing";
          linkElement.textContent = "Main Google Drive Directory";
        }
      })
      .catch(err => {
        console.error("CSV fetch error:", err);
        linkElement.href = "https://drive.google.com/drive/folders/1VFWVQGVfbEKE5mvQINWUNVe6IhwOl2FI?usp=sharing";
        linkElement.textContent = "Main Google Drive Directory";
      });
  } else if (linkElement) {
    // Handle the case where no Product ID could be parsed from the URL at all
    linkElement.href = "https://drive.google.com/drive/folders/1VFWVQGVfbEKE5mvQINWUNVe6IhwOl2FI?usp=sharing";
    linkElement.textContent = "Main Google Drive Directory";
  }
})();
