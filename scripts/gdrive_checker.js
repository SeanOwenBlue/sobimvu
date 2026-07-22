(function() {
    // 1. Dynamic URL parsing snippet with sandbox-safe regex backup
    let productId = null;
    try {
      const topUrl = new URL(window.parent.location.href);
      productId = topUrl.searchParams.get("products_id");
    } catch (e) {
      const frameUrl = new URL(window.location.href);
      productId = frameUrl.searchParams.get("products_id");
    }

    if (!productId) {
      const match = window.location.href.match(/[?&]products_id=(d+)/);
      productId = match ? match[1] : null;
    }

    const linkElement = document.getElementById('dynamic-gdrive-link');
    const csvUrl = "https://seanowenblue.github.io/sobimvu/products_index.csv";

    // 2. Process data match if an ID is present
    if (productId && linkElement) {
      productId = productId.trim();

      fetch(csvUrl)
        .then(response => response.text())
        .then(text => {
          //const cleanText = text.replace(/r/g, "");
          //const lines = cleanText.split("n");
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
            linkElement.href = "https://google.com";
            linkElement.textContent = "Main Google Drive Directory";
          }
        })
        .catch(err => {
          console.error("CSV fetch error:", err);
          linkElement.href = "https://google.com";
          linkElement.textContent = "Main Google Drive Directory";
        });
    }
  })();
