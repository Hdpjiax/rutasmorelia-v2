import os
import shutil

def main():
    # Paths relative to the root workspace directory
    # Note: the script is run from the workspace root or from the script's folder.
    # We will compute paths relative to this script's directory for reliability.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Workspace root is two levels up from viamoreliaapp/scripts/
    workspace_root = os.path.dirname(os.path.dirname(script_dir))
    
    src_dir = os.path.join(workspace_root, "public", "routes")
    dst_dir = os.path.join(workspace_root, "viamoreliaapp", "assets", "routes")
    
    print(f"Source directory: {src_dir}")
    print(f"Destination directory: {dst_dir}")
    
    if not os.path.exists(src_dir):
        print(f"Error: source directory {src_dir} does not exist.")
        return
        
    if not os.path.exists(dst_dir):
        print(f"Error: destination directory {dst_dir} does not exist. Creating it.")
        os.makedirs(dst_dir, exist_ok=True)
        
    # Get lists of files in source and destination
    src_files = set(os.listdir(src_dir))
    dst_files = set(os.listdir(dst_dir))
    
    # 1. Copy files from src to dst
    copied_count = 0
    for file_name in src_files:
        src_path = os.path.join(src_dir, file_name)
        dst_path = os.path.join(dst_dir, file_name)
        
        # Only copy files
        if os.path.isfile(src_path):
            shutil.copy2(src_path, dst_path)
            copied_count += 1
            
    print(f"Copied {copied_count} files to {dst_dir}.")
    
    # 2. Remove files in dst that are NOT in src
    removed_count = 0
    for file_name in dst_files:
        if file_name not in src_files:
            dst_path = os.path.join(dst_dir, file_name)
            if os.path.isfile(dst_path):
                os.remove(dst_path)
                removed_count += 1
                print(f"Removed obsolete asset file: {file_name}")
                
    print(f"Sync complete. Removed {removed_count} obsolete files.")

if __name__ == '__main__':
    main()
