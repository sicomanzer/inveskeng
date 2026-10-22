import time
import subprocess
import os
import sys
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SYNC_SCRIPT = os.path.join(BASE_DIR, "scripts", "sync_data.py")
INTERVAL_SECONDS = 15 * 60  # Sync every 15 minutes

def run_sync():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting scheduled sync from Investing.com...")
    try:
        proc = subprocess.run(
            [sys.executable, SYNC_SCRIPT, "--market=ALL"],
            capture_output=True,
            text=True,
            timeout=60
        )
        print(proc.stdout)
        if proc.stderr:
            print("[Stderr]:", proc.stderr)
    except Exception as e:
        print(f"[Error]: {e}")

def main():
    print(f"=== REA Investing.com Auto-Sync Scheduler Started ===")
    print(f"Sync Interval: {INTERVAL_SECONDS // 60} minutes")
    print(f"Target: Thailand (SET) & United States (US)")
    
    # Run once immediately on startup
    run_sync()

    while True:
        try:
            time.sleep(INTERVAL_SECONDS)
            run_sync()
        except KeyboardInterrupt:
            print("\nScheduler stopped.")
            break
        except Exception as e:
            print(f"Scheduler exception: {e}")
            time.sleep(60)

if __name__ == "__main__":
    main()
