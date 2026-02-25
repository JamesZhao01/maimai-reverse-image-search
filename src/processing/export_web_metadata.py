import os
import json
import pandas as pd

PROCESSED_DIR = os.path.join('data', 'processed')
WEB_DIR = os.path.join('web')

def main():
    metadata_csv = os.path.join(PROCESSED_DIR, 'metadata.csv')
    df = pd.read_csv(metadata_csv)
    
    # Group by imageName just like in the Python backend
    db = {}
    
    for _, row in df.iterrows():
        img = row['imageName']
        if pd.isna(img):
            continue
            
        if img not in db:
            db[img] = {
                'songId': str(row['songId']),
                'title': str(row['title']),
                'artist': str(row['artist']),
                'version': str(row['version']),
                'releaseDate': str(row.get('releaseDate', '')),
                'charts': []
            }
            
        db[img]['charts'].append({
            'type': str(row.get('type', '')),
            'difficulty': str(row.get('difficulty', '')),
            'level': str(row.get('level', '')),
            'internalLevel': str(row.get('internalLevelValue', ''))
        })

    out_file = os.path.join(WEB_DIR, 'metadata.json')
    with open(out_file, 'w') as f:
        json.dump(db, f)
        
    print(f"Exported metadata for {len(db)} images to {out_file}")

if __name__ == '__main__':
    main()
