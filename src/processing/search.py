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

def search_image_bytes(img_bytes, top_k=5, threshold=0.7, max_size=400, max_features=1000, min_level=0.0, max_level=15.0):
    if not _sift_cache:
        return {"matches": [], "dimensions": {}}

    # Decode image from bytes
    nparr = np.frombuffer(img_bytes, np.uint8)
    query_img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if query_img is None:
        return {"matches": [], "dimensions": {}}
        
    src_h, src_w = query_img.shape[:2]
    
    if src_w > max_size or src_h > max_size:
        scale = max_size / max(src_w, src_h)
        query_img = cv2.resize(query_img, (int(src_w * scale), int(src_h * scale)), interpolation=cv2.INTER_AREA)

    ext_h, ext_w = query_img.shape[:2]

    orb = cv2.ORB_create(nfeatures=max_features)
    _, query_desc = orb.detectAndCompute(query_img, None)

    dimensions_meta = {
        "src_w": src_w,
        "src_h": src_h,
        "ext_w": ext_w,
        "ext_h": ext_h
    }

    if query_desc is None or len(query_desc) < 2:
        return {"matches": [], "dimensions": dimensions_meta}

    results = []
    
    for filename, db_desc in _sift_cache.items():
        if db_desc is None or len(db_desc) < 2:
            continue
            
        # Level filtering
        meta = get_metadata(filename)
        if meta and 'charts' in meta:
            # Check if any chart in this song falls within the range
            match_range = False
            for chart in meta['charts']:
                if not isinstance(chart, dict):
                    continue
                try:
                    lvl_val = chart.get('internalLevel', '0') or chart.get('levelValue', '0') or '0'
                    lvl = float(lvl_val)
                    if min_level <= lvl <= max_level:
                        match_range = True
                        break
                except (ValueError, TypeError):
                    continue
            if not match_range:
                continue

        if _bf is None:
            continue

        try:
            matches = _bf.knnMatch(query_desc, db_desc, k=2)
            
            # Lowe's ratio test
            good_matches = 0
            for pair in matches:
                if len(pair) == 2:
                    m, n = pair
                    if m.distance < threshold * n.distance:
                        good_matches += 1
                        
            if good_matches > 0:
                results.append({
                    'imageName': filename,
                    'score': good_matches
                })
        except Exception:
            continue

    # Sort by descending score
    results.sort(key=lambda x: x['score'], reverse=True)
    top_results = results[:top_k]
    
    # Attach metadata
    for r in top_results:
        r.update(get_metadata(r['imageName']))
        
    return {
        "matches": top_results,
        "dimensions": dimensions_meta
    }
