document.addEventListener("DOMContentLoaded", () => {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const previewArea = document.getElementById("preview-area");
    const previewImage = document.getElementById("preview-image");
    const resultsArea = document.getElementById("results-area");
    const resultsGrid = document.getElementById("results-grid");

    // Handle Drag & Drop
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // Handle Browse button
    fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Handle paste from clipboard
    document.addEventListener("paste", (e) => {
        if (e.clipboardData && e.clipboardData.files.length > 0) {
            // Only process the first item if it's an image
            const file = e.clipboardData.files[0];
            if (file.type.startsWith('image/')) {
                handleFile(file);
            }
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith("image/")) {
            alert("Please upload a valid image file.");
            return;
        }

        // Set preview image
        const objUrl = URL.createObjectURL(file);
        previewImage.src = objUrl;

        // Show preview & loader
        dropZone.classList.add("hidden");
        resultsArea.classList.add("hidden");
        previewArea.classList.remove("hidden");
        resultsGrid.innerHTML = '';

        // Send the image to the backend
        uploadImage(file);
    }

    async function uploadImage(file) {
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/search", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();
            displayResults(data.matches || []);

        } catch (error) {
            console.error("Upload error:", error);
            alert("An error occurred during search. Ensure the backend is running and the SIFT cache is built.");
        } finally {
            // Hide loader, show results
            previewArea.querySelector('.loader').classList.add('hidden');
            previewArea.querySelector('h3').innerText = "Query Image";
            setTimeout(() => resultsArea.classList.remove("hidden"), 200);
        }
    }

    // Handle Refresh Button
    document.getElementById("refresh-btn").addEventListener("click", () => {
        resultsArea.classList.add("hidden");
        previewArea.classList.add("hidden");
        dropZone.classList.remove("hidden");
        previewImage.src = "";
        resultsGrid.innerHTML = "";
        fileInput.value = "";
    });

    function displayResults(matches) {
        if (matches.length === 0) {
            resultsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 1.2rem; padding: 40px 0;">No matches found.</p>`;
            return;
        }

        resultsGrid.innerHTML = matches.map((match, index) => {
            const rawImgUrl = `/raw/${match.imageName}`;

            // Select highest level chart to display, or just mapping them strings
            let chartDetails = '';
            if (match.charts && match.charts.length > 0) {
                // Find chart with highest internalLevel
                const sortedCharts = [...match.charts].sort((a, b) => parseFloat(b.internalLevel || 0) - parseFloat(a.internalLevel || 0));
                const topChart = sortedCharts[0];

                let diffColor = 'rgba(255,255,255,0.1)';
                if (topChart.difficulty === 'master') diffColor = 'rgba(190, 30, 190, 0.6)';
                if (topChart.difficulty === 'remaster') diffColor = 'rgba(255, 255, 255, 0.4)';
                if (topChart.difficulty === 'expert') diffColor = 'rgba(230, 44, 118, 0.6)';

                chartDetails = `
          <div class="result-meta-grid">
            <span class="meta-item" style="background: ${diffColor};">${(topChart.difficulty || 'N/A').toUpperCase()}</span>
            <span class="meta-item">Lv.${topChart.level || '?'} (${topChart.internalLevel || '?'})</span>
          </div>
        `;
            }

            const zetarakuUrl = `https://arcade-songs.zetaraku.dev/maimai/search/?title=${encodeURIComponent(match.title || '')}`;
            const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent('maimai ' + (match.title || ''))}`;

            return `
        <div class="result-card slide-up" style="animation-delay: ${index * 0.1}s">
          ${index === 0 ? '<div class="result-badge">#1 MATCH</div>' : `<div class="result-badge" style="background: var(--primary);">#${index + 1}</div>`}
          <div class="result-img-container">
            <img src="${rawImgUrl}" alt="${match.title}" class="result-img" onerror="this.src='https://via.placeholder.com/300?text=No+Image'" />
            <div class="similarity-score">Similarity: ${match.score} pts</div>
          </div>
          <div class="result-info">
            <div class="result-title" title="${match.title || 'Unknown Title'}">${match.title || match.imageName}</div>
            <div class="result-artist" title="${match.artist || 'Unknown Artist'}">${match.artist || 'Unknown'}</div>
            
            <div class="result-meta-row">
              ${match.version && match.version !== 'nan' ? `<div class="result-version">${match.version}</div>` : ''}
              ${match.releaseDate && match.releaseDate !== 'nan' ? `<div class="result-date">${match.releaseDate}</div>` : ''}
            </div>
            
            ${chartDetails}
            
            <div class="result-links">
              <a href="${zetarakuUrl}" target="_blank" class="link-btn">Arcade Songs</a>
              <a href="${ytUrl}" target="_blank" class="link-btn yt-btn">YouTube</a>
            </div>
          </div>
        </div>
      `;
        }).join("");
    }
});
