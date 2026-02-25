from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import sys
import os

# Ensure src module is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.processing.search import init_search, search_image_bytes

app = FastAPI(title="Maimai Reverse Image Search")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_search()

@app.post("/search")
async def search_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    results = search_image_bytes(contents, top_k=5)
    return {"matches": results}

# Mount images directory to serve thumbnails
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
raw_dir = os.path.join(BASE_DIR, 'data', 'raw', 'thumbnails')
if os.path.exists(raw_dir):
    app.mount("/raw", StaticFiles(directory=raw_dir), name="raw")

# Mount web directory to serve frontend
web_dir = os.path.join(BASE_DIR, 'web')
if os.path.exists(web_dir):
    app.mount("/", StaticFiles(directory=web_dir, html=True), name="web")

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
