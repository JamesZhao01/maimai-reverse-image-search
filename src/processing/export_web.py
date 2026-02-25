import cv2
import os
import pickle
import json
import base64
import numpy as np

RAW_DIR = os.path.join('data', 'raw', 'thumbnails')
WEB_DIR = os.path.join('web')

def main():
    print(f"Exporting SIFT database for the web...")
    
    # We will limit the keypoints to 100 to save bandwidth for the static site
    sift = cv2.SIFT_create(nfeatures=100)
    
    db = {}
    total = 0
    
    for filename in os.listdir(RAW_DIR):
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            continue
            
        img_path = os.path.join(RAW_DIR, filename)
        img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
            
        _, desc = sift.detectAndCompute(img, None)
        
        if desc is not None and len(desc) > 0:
            # Convert to float32, encode to base64
            encoded = base64.b64encode(desc.astype(np.float32).tobytes()).decode('ascii')
            db[filename] = {
                "rows": desc.shape[0],
                "data": encoded
            }
            total += 1
            if total % 100 == 0:
                print(f"Processed {total} images...")
                
    out_file = os.path.join(WEB_DIR, 'sift_db.json')
    with open(out_file, 'w') as f:
        json.dump(db, f)
        
    print(f"Exported {total} descriptors to {out_file} ({(os.path.getsize(out_file)/1024/1024):.1f} MB)")

if __name__ == '__main__':
    main()
