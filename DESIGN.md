# Design Doc of Reverse Image Search

## 1. Overview

This project is a reverse image search engine for the game maimai. It allows users to search for songs by providing an image of the song's chart.

## 2. Data

Data comes from https://arcade-songs.zetaraku.dev/maimai/. 
- https://github.com/zetaraku/arcade-songs
- https://github.com/zetaraku/arcade-songs-fetch

## 3. Local Architecture

- src/: Project root
  - scrape/: Anything related to scraping
  - processing/: Anything related to data processing
  - applet/: Anything related to the frontend to interact
- data/: Datasets
  - raw/: Raw data from arcade-songs-fetch
  - processed/: Processed data, plus metadata pandas dataframe mapping
- models/: Models
- web/: Web interface

# Your Instructions

- Understand how arcade-songs-fetch works and pull all data. You only need to pull charts that are 
  level 13 or higher, and not any utage charts.
- Scrape the thumbnails and make a dataset 
- Also scrape metadata, like note count, internal level, version.
- Make a small applet (e.g. react) that can take in a chart image, and return the top 5 most similar 
  songs from the dataset. Feel free to make a very lightweight backend as well. Should support image upload or paste from clipboard. 
- Process the images with SIFT descriptors to perform the exhaustive search. 