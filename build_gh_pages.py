import os
import shutil
import sys

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    web_dir = os.path.join(root_dir, 'web')
    raw_dir = os.path.join(root_dir, 'data', 'raw', 'thumbnails')
    out_dir = os.path.join(root_dir, 'docs')
    
    # 1. Ensure out_dir exists and is clean
    if os.path.exists(out_dir):
        print(f"Cleaning existing directory: {out_dir}")
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)
    
    # 2. Check if web dir has the important files
    required_web_files = ['index.html', 'styles.css', 'app.js', 'sift_db.json', 'metadata.json', 'info.json']
    for file in required_web_files:
        src = os.path.join(web_dir, file)
        if not os.path.exists(src):
            print(f"Error: Required file {src} not found. Please run the export scripts first.")
            sys.exit(1)
            
    # 3. Copy web files
    print("Copying web files...")
    for file in os.listdir(web_dir):
        src = os.path.join(web_dir, file)
        if os.path.isfile(src):
            shutil.copy2(src, os.path.join(out_dir, file))
            print(f"  Copied {file}")
            

    # 5. Success
    print("\n✅ Build complete! The 'docs' folder is ready to be deployed.")
    print("To test locally without the backend, run: python -m http.server 8080 --directory docs")

if __name__ == "__main__":
    main()
