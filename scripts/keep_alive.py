#!/usr/bin/env python3
"""
CARDIA Backend Keep-Alive Monitor Script
Pings https://cardia-api-6gif.onrender.com/api/health every 10 minutes
to prevent Render free-tier spin-down (inactivity threshold is 15 minutes).
"""

import sys
import time
import urllib.request
import urllib.error
import json
from datetime import datetime, timezone

TARGET_URL = "https://cardia-api-6gif.onrender.com/api/health"
INTERVAL_SECONDS = 600  # 10 minutes
TIMEOUT_SECONDS = 60

def ping_health() -> bool:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    req = urllib.request.Request(
        TARGET_URL,
        headers={"User-Agent": "CARDIA-KeepAlive-Monitor/1.0"}
    )
    try:
        start_time = time.time()
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
            duration = round(time.time() - start_time, 2)
            status = response.getcode()
            body = response.read().decode("utf-8")
            data = json.loads(body)
            print(f"[{timestamp}] SUCCESS {status} in {duration}s: status={data.get('status')}, models={len(data.get('models_loaded', {}))}")
            return True
    except urllib.error.HTTPError as e:
        print(f"[{timestamp}] HTTP ERROR {e.code}: {e.reason}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[{timestamp}] CONNECTION ERROR: {e}", file=sys.stderr)
        return False

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        success = ping_health()
        sys.exit(0 if success else 1)

    print(f"Starting CARDIA keep-alive monitor for {TARGET_URL}")
    print(f"Pinging every {INTERVAL_SECONDS} seconds (10 minutes). Press Ctrl+C to stop.\n")
    while True:
        ping_health()
        time.sleep(INTERVAL_SECONDS)

if __name__ == "__main__":
    main()
