import cv2
import pickle
import os
import numpy as np
import pandas as pd

MODEL_DIR = os.path.join('models')
CACHE_FILE = os.path.join(MODEL_DIR, 'sift_cache.pkl')
METADATA_FILE = os.path.join('data', 'processed', 'metadata.csv')

_sift_cache = None
_metadata_df = None
_bf = None

def init_search():
    global _sift_cache, _metadata_df, _bf
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'rb') as f:
            _sift_cache = pickle.load(f)
    else:
        _sift_cache = {}

    if os.path.exists(METADATA_FILE):
        _metadata_df = pd.read_csv(METADATA_FILE)
    else:
        _metadata_df = pd.DataFrame()

    _bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    print("Search module initialized.")

def get_metadata(image_name):
    if _metadata_df is None or _metadata_df.empty:
        return {}
    
    # We might have multiple charts per image. We will return all chart variations.
    rows = _metadata_df[_metadata_df['imageName'] == image_name]
    if rows.empty:
        return {}
        
    first_row = rows.iloc[0]
    charts = []
    for _, row in rows.iterrows():
        charts.append({
            'type': str(row.get('type', '')),
            'difficulty': str(row.get('difficulty', '')),
            'level': str(row.get('level', '')),
            'internalLevel': str(row.get('internalLevelValue', '')),
        })
        
    return {
        'songId': str(first_row['songId']),
        'title': str(first_row['title']),
        'artist': str(first_row['artist']),
        'version': str(first_row.get('version', '')),
        'charts': charts
    }

def search_image_bytes(img_bytes, top_k=5):
    if not _sift_cache:
        return []

    # Decode image from bytes
    nparr = np.frombuffer(img_bytes, np.uint8)
    query_img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if query_img is None:
        return []
        
    orb = cv2.ORB_create(nfeatures=1000)
    _, query_desc = orb.detectAndCompute(query_img, None)

    if query_desc is None or len(query_desc) < 2:
        return []

    results = []
    
    for filename, db_desc in _sift_cache.items():
        if db_desc is None or len(db_desc) < 2:
            continue
            
        try:
            matches = _bf.knnMatch(query_desc, db_desc, k=2)
            
            # Lowe's ratio test
            good_matches = 0
            for pair in matches:
                if len(pair) == 2:
                    m, n = pair
                    if m.distance < 0.7 * n.distance:
                        good_matches += 1
                        
            if good_matches > 0:
                results.append({
                    'imageName': filename,
                    'score': good_matches
                })
        except Exception as e:
            continue

    # Sort by descending score
    results.sort(key=lambda x: x['score'], reverse=True)
    top_results = results[:top_k]
    
    # Attach metadata
    for r in top_results:
        r.update(get_metadata(r['imageName']))
        
    return top_results
