"""
view_ipcam.py

Opens your phone's IP webcam stream in a normal OpenCV video window.
Useful for checking the camera angle before using detect_spots.py.

Usage:
    python view_ipcam.py --url http://192.168.1.6:8080/video

Controls:
    q  – quit
    s  – save current frame as PNG
"""

import argparse
import os
import sys
import time

try:
    import cv2
    import numpy as np
except ImportError:
    print("Missing dependencies. Run:")
    print("  pip install opencv-python numpy")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("Missing requests. Run:")
    print("  pip install requests")
    sys.exit(1)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))


def fetch_frame_http(url, timeout=4):
    try:
        resp = requests.get(url, timeout=timeout)
        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
            arr = np.frombuffer(resp.content, np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is not None:
                return frame
    except requests.exceptions.RequestException:
        pass
    return None


def main():
    parser = argparse.ArgumentParser(description="View IP webcam stream in a window.")
    parser.add_argument("--url", required=True, help="IP webcam URL, e.g. http://192.168.x.x:8080/video")
    parser.add_argument("--save", default="", help="Directory to save captured PNG frames")
    args = parser.parse_args()

    if args.save:
        os.makedirs(args.save, exist_ok=True)

    url = args.url
    is_snapshot = url.endswith("/shot.jpg") or "/shot" in url or "snapshot" in url

    window_name = "IP Webcam"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 1280, 720)

    cap = None
    if not is_snapshot:
        cap = cv2.VideoCapture(url)
        if not cap.isOpened():
            print(f"Could not open stream: {url}")
            return

    print("Streaming...  Press 'q' to quit, 's' to save frame.")
    try:
        while True:
            frame = None
            if is_snapshot:
                frame = fetch_frame_http(url)
                if frame is None:
                    time.sleep(0.05)
                    continue
            else:
                ret, frame = cap.read()
                if not ret:
                    print("Stream ended or frame not received.")
                    break

            cv2.imshow(window_name, frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            if key == ord("s"):
                fname = os.path.join(args.save or BACKEND_DIR, f"frame_{int(time.time())}.png")
                cv2.imwrite(fname, frame)
                print(f"Saved: {fname}")
    except KeyboardInterrupt:
        pass
    finally:
        if cap is not None:
            cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
