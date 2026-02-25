# maimai Reverse Image Search

A reverse image search engine that identifies maimai charts from screenshots. Developed primarily to help players identify level 13+ charts and above from standard play setups or clips.

## Project Structure

- `src/scrape`: Scripts for fetching metadata and thumbnails from [arcade-songs](https://github.com/zetaraku/arcade-songs) and [arcade-songs-fetch](https://github.com/zetaraku/arcade-songs-fetch).
- `src/processing`: Core computer vision algorithms, built on OpenCV's SIFT descriptors and Flann based matching.
- `src/applet/backend`: A robust FastAPI backend exposing search functionality and statically serving the web frontend.
- `models`: Stores the precomputed `sift_cache.pkl` built from the chart thumbnails.
- `data`:
  - `raw/thumbnails`: Raw scraped image files for chart covers.
  - `processed/metadata.csv`: Parsed song metadata mapping for fast retrieval.
- `web`: Sleek, dynamic Vanilla JS frontend with drag-and-drop and clipboard paste capability.

## Installation

### Prerequisites

- Python 3.8+
- pip (Python package manager)

### Quick Start

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run Data Generation (Only required if you want to rebuild the local cache)**
   By default, the cache logic allows building your own database. If this is a fresh pull, you need to populate the database:

   ```bash
   # Download metadata and cover thumbnails 
   # (Note: Set to fetch Level 13+ Non-Utage songs by default)
   python src/scrape/fetch_data.py

   # Compute SIFT descriptors and store to models/sift_cache.pkl
   python src/processing/compute_sift.py
   ```

3. **Start the server**
   ```bash
   python -m uvicorn src.applet.backend.main:app --host 0.0.0.0 --port 8000
   ```
   Or if using npm scripts (optional setup):
   ```bash
   npm run start
   ```

4. **Open the web interface**
   Navigate your browser to [http://localhost:8000](http://localhost:8000).

## Usage

Once the interface is open, you have two ways to search:
1. **File Upload via Drag and Drop:** Drag any cropped or uncropped screenshot of a maimai chart into the upload zone, or click it to browse files.
2. **Clipboard Paste:** Copy an image to your clipboard and simply press `Ctrl+V` while on the webpage. 

The application will process the image locally and display the top 5 match candidates in a beautifully styled grid, including the predicted song's title, artist, version, and thumbnail cover.
