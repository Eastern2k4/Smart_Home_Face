#!/usr/bin/env python3
"""
Quick diagnostic script to test ESP32 connectivity
Run this to debug ESP32 connection issues
"""

import sys
import requests
from urllib.parse import urljoin, urlparse


def test_esp32(camera_url, timeout=10):
    """Test if ESP32 camera is reachable"""

    # Normalize URL
    if not camera_url.startswith("http://") and not camera_url.startswith("https://"):
        camera_url = "http://" + camera_url

    parsed_url = urlparse(camera_url)
    if not parsed_url.path or parsed_url.path == "/":
        camera_url = urljoin(camera_url, "/capture")

    print(f"\n{'='*60}")
    print(f"ESP32 Camera Connectivity Test")
    print(f"{'='*60}")
    print(f"Testing URL: {camera_url}")
    print(f"Timeout: {timeout} seconds\n")

    try:
        # Test 1: HEAD request (quick check)
        print("[1/2] Testing connectivity with HEAD request...")
        response = requests.head(camera_url, timeout=5, allow_redirects=True)
        print(f"     ✓ Connected! Status: {response.status_code}")
        print(
            f"     ✓ Content-Type: {response.headers.get('content-type', 'Not specified')}"
        )

        # Test 2: GET request (full fetch)
        print("\n[2/2] Fetching snapshot with GET request...")
        response = requests.get(camera_url, timeout=timeout, stream=False)
        size_mb = len(response.content) / (1024 * 1024)
        print(
            f"     ✓ Successfully fetched {len(response.content)} bytes ({size_mb:.2f} MB)"
        )
        print(
            f"     ✓ Content-Type: {response.headers.get('content-type', 'Not specified')}"
        )

        # Save the snapshot
        snapshot_file = "esp32_test_snapshot.jpg"
        with open(snapshot_file, "wb") as f:
            f.write(response.content)
        print(f"     ✓ Saved to: {snapshot_file}")

        print(f"\n{'='*60}")
        print("✅ SUCCESS! ESP32 is working correctly.")
        print(f"{'='*60}\n")
        return True

    except requests.exceptions.Timeout:
        print(f"\n❌ TIMEOUT: ESP32 not responding within {timeout}s")
        print("\nPossible causes:")
        print("  • ESP32 is powered off")
        print("  • Wrong IP address")
        print("  • Network connectivity issue")
        print("  • ESP32 is busy processing")
        print("  • Firewall blocking the connection")

    except requests.exceptions.ConnectionError as e:
        print(f"\n❌ CONNECTION ERROR: Cannot reach ESP32")
        print(f"   Details: {str(e)}")
        print("\nPossible causes:")
        print("  • Wrong IP address")
        print("  • ESP32 is not connected to network")
        print("  • Firewall or network policy blocking")

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        print(f"   Type: {type(e).__name__}")

    print(f"\n{'='*60}\n")
    return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_esp32.py <camera_url>")
        print("\nExamples:")
        print("  python test_esp32.py 172.16.2.105")
        print("  python test_esp32.py http://172.16.2.105/capture")
        print("  python test_esp32.py 192.168.1.100")
        sys.exit(1)

    camera_url = sys.argv[1]
    timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 15

    success = test_esp32(camera_url, timeout=timeout)
    sys.exit(0 if success else 1)
