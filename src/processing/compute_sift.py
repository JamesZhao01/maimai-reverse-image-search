import cv2
import os
import pickle
import numpy as np

RAW_DIR = os.path.join('data', 'raw', 'thumbnails')
MODEL_DIR = os.path.join('models')
CACHE_FILE = os.path.join(MODEL_DIR, 'sift_cache.pkl')

os.makedirs(MODEL_DIR, exist_ok=True)

def extract_features(img_path):
    img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return None, None
    sift = cv2.SIFT_create()
    keypoints, descriptors = sift.detectAndCompute(img, None)
    return keypoints, descriptors

def main():
    print(f"Loading images from {RAW_DIR}...")
    sift_cache = {}
    
    # Check if RAW_DIR exists
    if not os.path.exists(RAW_DIR):
        print(f"Directory {RAW_DIR} not found.")
        return
        
    for filename in os.listdir(RAW_DIR):
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            continue
            
        img_path = os.path.join(RAW_DIR, filename)
        _, descriptors = extract_features(img_path)
        
        if descriptors is not None:
            # We don't save keypoints usually because they are large and cause issues with pickle.
            # Flann matcher only needs descriptors. 
            sift_cache[filename] = descriptors
            
    with open(CACHE_FILE, 'wb') as f:
        pickle.dump(sift_cache, f)
        
    print(f"Computed and saved SIFT descriptors for {len(sift_cache)} images to {CACHE_FILE}")

if __name__ == '__main__':
    main()
