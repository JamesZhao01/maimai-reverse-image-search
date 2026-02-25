let isLocalMode = true;
let localDb = null;
let localMetadata = null;
let cvOrb = null;
let cvBf = null;
let cvReady = false;

// Cache the latest query descriptors for real-time slider threshold changes
let currentQueryObjUrl = null;

// cvReady is now defined globally in index.html
window.initOpenCvDependentState = function () {
    const modeToggle = document.getElementById("local-mode-toggle");
    if (modeToggle && modeToggle.checked) {
        modeToggle.dispatchEvent(new Event('change'));
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const previewArea = document.getElementById("preview-area");
    const previewImage = document.getElementById("preview-image");
    const resultsArea = document.getElementById("results-area");
    const resultsGrid = document.getElementById("results-grid");
    const modeToggle = document.getElementById("local-mode-toggle");
    const modeLabel = document.getElementById("mode-label");
    const uploadBtn = document.querySelector(".upload-btn");
    const settingsPanel = document.getElementById("settings-panel");
    const thresholdSlider = document.getElementById("threshold-slider");
    const thresholdLabel = document.getElementById("threshold-label");
    const sizeSlider = document.getElementById("size-slider");
    const sizeLabel = document.getElementById("size-label");
    const featuresSlider = document.getElementById("features-slider");
    const featuresLabel = document.getElementById("features-label");
    const minLevelSlider = document.getElementById("min-level-slider");
    const maxLevelSlider = document.getElementById("max-level-slider");
    const levelLabel = document.getElementById("level-label");
    const lastUpdatedLabel = document.getElementById("last-updated");
    const metricsText = document.getElementById("metrics-text");
    const cancelBtn = document.getElementById("cancel-btn");
    const progressText = document.getElementById("progress-text");
    const processingStatus = document.getElementById("processing-status");

    let currentSearchCancelled = false;

    // Base URL computation for GitHub Pages
    const basePath = window.location.pathname.endsWith('/') ? window.location.pathname : window.location.pathname + '/';

    // Fetch and display last updated time
    fetch(basePath + "info.json")
        .then(res => res.json())
        .then(data => {
            if (data.lastUpdated) {
                lastUpdatedLabel.innerText = `Data last updated: ${data.lastUpdated}`;
            }
        })
        .catch(err => console.log("Could not load info.json", err));

    // Threshold Slider update
    thresholdSlider.addEventListener("input", (e) => {
        thresholdLabel.innerText = `Match strictness (Lowe's Ratio): ${parseFloat(e.target.value).toFixed(2)}`;
    });

    sizeSlider.addEventListener("input", (e) => {
        sizeLabel.innerText = `Max Image Size: ${e.target.value}px`;
    });

    featuresSlider.addEventListener("input", (e) => {
        featuresLabel.innerText = `Max ORB Features: ${e.target.value}`;
    });

    const updateLevelLabel = () => {
        levelLabel.innerText = `Difficulty Filter: ${parseFloat(minLevelSlider.value).toFixed(1)} - ${parseFloat(maxLevelSlider.value).toFixed(1)}`;
    };

    minLevelSlider.addEventListener("input", (e) => {
        if (parseFloat(minLevelSlider.value) > parseFloat(maxLevelSlider.value)) {
            maxLevelSlider.value = minLevelSlider.value;
        }
        updateLevelLabel();
    });

    maxLevelSlider.addEventListener("input", (e) => {
        if (parseFloat(maxLevelSlider.value) < parseFloat(minLevelSlider.value)) {
            minLevelSlider.value = maxLevelSlider.value;
        }
        updateLevelLabel();
    });

    const triggerReSearch = () => {
        if (isLocalMode && currentQueryObjUrl) {
            currentSearchCancelled = true; // Cancel existing first
            setTimeout(() => {
                processLocal(null, currentQueryObjUrl);
            }, 50);
        }
    };

    thresholdSlider.addEventListener("change", triggerReSearch);
    sizeSlider.addEventListener("change", triggerReSearch);
    featuresSlider.addEventListener("change", triggerReSearch);
    minLevelSlider.addEventListener("change", triggerReSearch);
    maxLevelSlider.addEventListener("change", triggerReSearch);

    cancelBtn.addEventListener("click", () => {
        currentSearchCancelled = true;
        cancelBtn.disabled = true;
        cancelBtn.innerText = "Cancelling...";
    });

    // Trigger mode loading correctly immediately on startup since default is true
    setTimeout(() => {
        modeToggle.checked = true;
        modeToggle.dispatchEvent(new Event('change'));
    }, 100);

    // Handle Mode Toggle
    modeToggle.addEventListener("change", async (e) => {
        isLocalMode = e.target.checked;
        modeLabel.innerText = isLocalMode ? "Local Mode (WASM)" : "Remote Mode";

        if (isLocalMode) {
            settingsPanel.classList.remove("hidden");
        } else {
            settingsPanel.classList.add("hidden");
        }

        if (isLocalMode && (!localDb || !localMetadata)) {
            if (!window.cvReady) {
                console.log("OpenCV.js has not finished loading yet, waiting for callback.");
                return;
            }

            const oldText = uploadBtn.innerText;
            uploadBtn.innerText = "Downloading DB (~70MB)...";
            modeToggle.disabled = true;

            try {
                const [dbRes, metaRes] = await Promise.all([
                    fetch(basePath + 'sift_db.json'),
                    fetch(basePath + 'metadata.json')
                ]);
                localDb = await dbRes.json();
                localMetadata = await metaRes.json();

                // Initialize matcher
                if (!cvOrb) {
                    cvOrb = new cv.ORB(1000);
                    cvBf = new cv.BFMatcher(cv.NORM_HAMMING, false);
                }

                console.log("Local database loaded!");
            } catch (err) {
                console.error(err);
                alert("Failed to load local database.");
                modeToggle.checked = false;
                isLocalMode = false;
                modeLabel.innerText = "Remote Mode";
            } finally {
                uploadBtn.innerText = oldText;
                modeToggle.disabled = false;
            }
        }
    });

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
            const file = e.clipboardData.files[0];
            if (file.type.startsWith('image/')) {
                handleFile(file);
            }
        }
    });

    // Handle Refresh Button
    document.getElementById("refresh-btn").addEventListener("click", () => {
        resultsArea.classList.add("hidden");
        previewArea.classList.add("hidden");
        dropZone.classList.remove("hidden");
        previewImage.src = "";
        resultsGrid.innerHTML = "";
        fileInput.value = "";
    });

    function handleFile(file) {
        if (!file.type.startsWith("image/")) {
            alert("Please upload a valid image file.");
            return;
        }

        const objUrl = URL.createObjectURL(file);
        previewImage.src = objUrl;

        dropZone.classList.add("hidden");
        resultsArea.classList.add("hidden");
        previewArea.classList.remove("hidden");
        resultsGrid.innerHTML = '';
        metricsText.innerText = '';

        currentQueryObjUrl = objUrl;

        if (isLocalMode) {
            processLocal(file, objUrl);
        } else {
            uploadImage(file);
        }
    }

    // ==== REMOTE MODE ====
    async function uploadImage(file, isRetry = false) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("threshold", thresholdSlider.value);
        formData.append("maxSize", sizeSlider.value);
        formData.append("maxFeatures", featuresSlider.value);
        formData.append("minLevel", minLevelSlider.value);
        formData.append("maxLevel", maxLevelSlider.value);

        processingStatus.classList.remove('hidden');
        progressText.innerText = "Processing remotely...";
        cancelBtn.classList.add("hidden");

        try {
            // Use absolute URL or relative depending on environment, but since this is dynamic 
            // and remote mode only works locally or against a deployed API, we fallback to relative first.
            let fetchUrl = isRetry ? "http://127.0.0.1:8000/search" : "/search";
            const response = await fetch(fetchUrl, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }

            const data = await response.json();

            if (data.dimensions && data.dimensions.src_w) {
                metricsText.innerText = `Source Dimension: ${data.dimensions.src_w}x${data.dimensions.src_h}\nExtraction Dimension: ${data.dimensions.ext_w}x${data.dimensions.ext_h}`;
            }

            displayResults(data.matches || []);
        } catch (error) {
            console.error("Upload error:", error);
            if (!isRetry) {
                console.log("Retrying with absolute local URL...");
                return uploadImage(file, true);
            }
            alert("An error occurred during search. Ensure the backend is running and the SIFT cache is built.");
        } finally {
            if (isRetry || !error) {
                finishProcessing();
            }
        }
    }

    // ==== LOCAL MODE ====
    function processLocal(file, objUrl) {
        if (!window.cvReady || !cvOrb || !localDb) {
            alert("Local environment not fully loaded.");
            return;
        }

        processingStatus.classList.remove('hidden');
        progressText.innerText = "Loading image...";
        cancelBtn.classList.remove("hidden");
        cancelBtn.disabled = false;
        cancelBtn.innerText = "Cancel Search";
        currentSearchCancelled = false;

        const imgElement = new Image();
        imgElement.src = objUrl;
        imgElement.onload = () => {
            // Small timeout to allow UI update
            setTimeout(() => {
                try {
                    progressText.innerText = "Downsampling & extracting features...";

                    const srcRaw = cv.imread(imgElement);
                    const src = new cv.Mat();

                    let maxSize = parseInt(sizeSlider.value);
                    if (srcRaw.cols > maxSize || srcRaw.rows > maxSize) {
                        let scale = maxSize / Math.max(srcRaw.cols, srcRaw.rows);
                        let dsize = new cv.Size(Math.round(srcRaw.cols * scale), Math.round(srcRaw.rows * scale));
                        cv.resize(srcRaw, src, dsize, 0, 0, cv.INTER_AREA);
                        metricsText.innerText = `Source Dimension: ${srcRaw.cols}x${srcRaw.rows}\nExtraction Dimension: ${dsize.width}x${dsize.height}`;
                    } else {
                        srcRaw.copyTo(src);
                        metricsText.innerText = `Source Dimension: ${srcRaw.cols}x${srcRaw.rows}\nExtraction Dimension: ${src.cols}x${src.rows}`;
                    }
                    srcRaw.delete();

                    const gray = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

                    const maxFeatures = parseInt(featuresSlider.value);
                    if (cvOrb) cvOrb.delete();
                    cvOrb = new cv.ORB(maxFeatures);

                    const keypoints = new cv.KeyPointVector();
                    const queryDesc = new cv.Mat();
                    cvOrb.detectAndCompute(gray, new cv.Mat(), keypoints, queryDesc);

                    if (queryDesc.empty()) {
                        displayResults([]);
                        src.delete(); gray.delete(); keypoints.delete(); queryDesc.delete();
                        return;
                    }

                    progressText.innerText = "Matching database...";
                    let results = [];
                    const dbKeys = Object.keys(localDb);
                    let currentIndex = 0;
                    const batchSize = 100;

                    const matchThreshold = parseFloat(thresholdSlider.value);
                    const minLevel = parseFloat(minLevelSlider.value);
                    const maxLevel = parseFloat(maxLevelSlider.value);

                    const b64ToUint8Array = (b64) => {
                        const bin = atob(b64);
                        const bytes = new Uint8Array(bin.length);
                        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                        return bytes;
                    };

                    function processBatch() {
                        if (currentSearchCancelled || !isLocalMode) {
                            src.delete(); gray.delete(); keypoints.delete(); queryDesc.delete();
                            finishProcessing();
                            displayResults([]);
                            return;
                        }

                        let end = Math.min(currentIndex + batchSize, dbKeys.length);
                        for (let i = currentIndex; i < end; i++) {
                            let key = dbKeys[i];

                            // Difficulty Filter (Local)
                            let meta = localMetadata[key];
                            if (meta && meta.charts) {
                                let match_range = false;
                                for (let chart of meta.charts) {
                                    let lvl = parseFloat(chart.internalLevel || chart.level || 0);
                                    if (lvl >= minLevel && lvl <= maxLevel) {
                                        match_range = true;
                                        break;
                                    }
                                }
                                if (!match_range) continue;
                            }

                            let val = localDb[key];
                            let arr = b64ToUint8Array(val.data);
                            let dbMat = cv.matFromArray(val.rows, 32, cv.CV_8U, arr);

                            let matches = new cv.DMatchVectorVector();
                            cvBf.knnMatch(queryDesc, dbMat, matches, 2);

                            let good = 0;
                            for (let j = 0; j < matches.size(); j++) {
                                let match = matches.get(j);
                                if (match.size() == 2) {
                                    let m = match.get(0);
                                    let n = match.get(1);
                                    if (m.distance < matchThreshold * n.distance) {
                                        good++;
                                    }
                                }
                            }

                            if (good > 0) {
                                results.push({ imageName: key, score: good });
                            }
                            dbMat.delete();
                            matches.delete();
                        }

                        currentIndex = end;
                        progressText.innerText = `Matched ${currentIndex} / ${dbKeys.length}`;

                        if (currentIndex < dbKeys.length) {
                            requestAnimationFrame(processBatch);
                        } else {
                            results.sort((a, b) => b.score - a.score);
                            let topK = results.slice(0, 5);

                            // Attach metadata
                            topK.forEach(r => {
                                let meta = localMetadata[r.imageName];
                                if (meta) {
                                    r.songId = meta.songId;
                                    r.title = meta.title;
                                    r.artist = meta.artist;
                                    r.version = meta.version;
                                    r.charts = meta.charts;
                                    r.releaseDate = meta.releaseDate;
                                }
                            });

                            src.delete(); gray.delete(); keypoints.delete(); queryDesc.delete();
                            displayResults(topK);
                            finishProcessing();
                        }
                    }

                    requestAnimationFrame(processBatch);

                } catch (e) {
                    console.error("Local CV Processing Error: ", e);
                    alert("Error processing image locally.");
                    finishProcessing();
                }
            }, 50);
        };
    }

    function finishProcessing() {
        processingStatus.classList.add('hidden');
        previewArea.querySelector('h3').innerText = "Query Image";
        setTimeout(() => resultsArea.classList.remove("hidden"), 200);
    }

    function displayResults(matches) {
        if (matches.length === 0) {
            resultsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 1.2rem; padding: 40px 0;">No matches found.</p>`;
            return;
        }

        resultsGrid.innerHTML = matches.map((match, index) => {
            const rawImgUrl = `https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover/${match.imageName}`;

            let chartDetails = '';
            if (match.charts && match.charts.length > 0) {
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

            const zetarakuUrl = `https://arcade-songs.zetaraku.dev/maimai/?title=${encodeURIComponent(match.title || '')}`;
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
