#!/usr/bin/env python3
"""
Wrapper script to execute Spine Toolbox projects and show results.
Since Spine Toolbox doesn't output logs in Docker, we show execution results instead.
"""
import subprocess
import sys
import os
import time
import glob
from pathlib import Path

def main():
    if len(sys.argv) < 2:
        print("Usage: spine_execute_wrapper.py <project_path>", file=sys.stderr)
        sys.exit(1)
    
    project_path = sys.argv[1]
    
    if not os.path.exists(project_path):
        print(f"Error: Project path does not exist: {project_path}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Starting Spine Toolbox execution...")
    print(f"Project: {project_path}")
    print("=" * 80)
    sys.stdout.flush()
    
    # Record start time
    start_time = time.time()
    
    # Set environment variables
    env = os.environ.copy()
    env['PYTHONMULTIPROCESSINGSTARTMETHOD'] = 'spawn'
    env['QT_QPA_PLATFORM'] = 'offscreen'
    
    # Run spinetoolbox headless mode
    result = subprocess.run(
        ['python', '-m', 'spinetoolbox.headless', '--execute-only', project_path],
        env=env,
        capture_output=True,
        text=True
    )
    
    # Calculate execution time
    execution_time = time.time() - start_time
    
    # Print any output (usually empty)
    if result.stdout:
        print(result.stdout, flush=True)
    if result.stderr:
        print(result.stderr, file=sys.stderr, flush=True)
    
    print("=" * 80)
    print(f"Execution completed in {execution_time:.2f} seconds")
    print(f"Return code: {result.returncode}")
    
    # Show execution results
    if result.returncode == 0:
        print("\n✓ Execution successful!")
        print("\nModified files:")
        items_dir = os.path.join(project_path, '.spinetoolbox', 'items')
        if os.path.exists(items_dir):
            for item_name in os.listdir(items_dir):
                item_path = os.path.join(items_dir, item_name)
                if os.path.isdir(item_path):
                    files = glob.glob(os.path.join(item_path, '**/*'), recursive=True)
                    recent_files = [f for f in files if os.path.isfile(f) and os.path.getmtime(f) > start_time - 5]
                    if recent_files:
                        print(f"\n  {item_name}/:")
                        for f in recent_files:
                            size = os.path.getsize(f)
                            print(f"    - {os.path.basename(f)} ({size} bytes)")
    else:
        print(f"\n✗ Execution failed with return code {result.returncode}")
    
    print("=" * 80)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
