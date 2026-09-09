"""
detect_spots.py

Detects cars in an image/frame using a pretrained YOLOv8 model, then checks
each parking spot (defined in spots.json, created by mark_spots.py) to see
whether a car is parked in it.

SETUP (run once):
    pip install ultralytics opencv-python requests --break-system-packages

HOW TO USE (single image test):
    python detect_spots.py --image current_frame.jpg --spots spots.json

HOW TO USE (continuous, e.g. from a video file or RTSP camera stream):
    python detect_spots.py --video 0 --spots spots.json --interval 5
    (use --video rtsp://... for an IP camera, or a path to a video file)

HOW TO USE (IP Webcam from phone):
    python detect_spots.py --ipcam http://192.168.1.100:8080/shot.jpg --spots spots.json --interval 2
    python detect_spots.py --ipcam http://192.168.1.100:8080/video --spots spots.json --interval 0.1

OUTPUT:
Prints and saves a JSON file (status.json) like:
{
  "spot_1": "occupied",
  "spot_2": "available",
  "spot_3": "occupied"
}
This status.json is what your webapp backend should read/serve to the frontend.
"""

import cv2
import json
import time
import argparse
import numpy as np
import requests
from ultralytics import YOLO

try:
    import tkinter as tk
    HAS_TK = True
except Exception:
    HAS_TK = False

# Classes in the COCO dataset (what YOLOv8's default weights are trained on)
# that count as "a vehicle occupying a spot"
VEHICLE_CLASS_NAMES = {"car", "truck", "bus", "motorcycle"}

# How much a detected vehicle box must overlap a spot polygon to count as "occupied"
OVERLAP_THRESHOLD = 0.15

MAX_WINDOW_FRACTION = 0.85


def get_screen_size():
    if HAS_TK:
        root = tk.Tk()
        root.update_idletasks()
        root.attributes("-alpha", 0)
        root.attributes("-topmost", True)
        width = root.winfo_screenwidth()
        height = root.winfo_screenheight()
        root.destroy()
        return width, height
    return 1920, 1080


def fit_frame_to_screen(frame, max_window_fraction=MAX_WINDOW_FRACTION):
    screen_w, screen_h = get_screen_size()
    target_w = int(screen_w * max_window_fraction)
    target_h = int(screen_h * max_window_fraction)
    h, w = frame.shape[:2]
    scale = min(target_w / w, target_h / h, 1.0)
    if scale < 1.0:
        new_w, new_h = int(w * scale), int(h * scale)
        frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
    else:
        new_w, new_h = w, h
    return frame, scale, new_w, new_h


def is_normalized(spots):
    if not spots:
        return False
    for spot in spots:
        for p in spot.get("points", []):
            if p[0] > 1.0 or p[1] > 1.0:
                return False
    return True


def polygon_mask(shape, points):
    if is_normalized([{"points": points}]):
        h, w = shape[:2]
        pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in points], dtype=np.int32)
    else:
        pts = np.array(points, dtype=np.int32)
    mask = np.zeros(shape[:2], dtype=np.uint8)
    cv2.fillPoly(mask, [pts], 1)
    return mask


def box_mask(shape, box):
    x1, y1, x2, y2 = [int(v) for v in box]
    mask = np.zeros(shape[:2], dtype=np.uint8)
    mask[y1:y2, x1:x2] = 1
    return mask


def overlap_ratio(spot_mask, veh_mask):
    intersection = np.logical_and(spot_mask, veh_mask).sum()
    spot_area = spot_mask.sum()
    if spot_area == 0:
        return 0.0
    return intersection / spot_area


def check_spots(frame, spots, model):
    results = model(frame, verbose=False, conf=0.25)[0]
    vehicle_masks = []

    for box, cls_id in zip(results.boxes.xyxy.cpu().numpy(),
                            results.boxes.cls.cpu().numpy()):
        class_name = model.names[int(cls_id)]
        if class_name in VEHICLE_CLASS_NAMES:
            vehicle_masks.append(box_mask(frame.shape, box))

    status = {}
    for spot in spots:
        spot_mask = polygon_mask(frame.shape, spot["points"])
        occupied = False
        for veh_mask in vehicle_masks:
            if overlap_ratio(spot_mask, veh_mask) >= OVERLAP_THRESHOLD:
                occupied = True
                break
        status[spot["id"]] = "occupied" if occupied else "available"

    return status


def draw_debug(frame, spots, status):
    h, w = frame.shape[:2]
    for spot in spots:
        if is_normalized([spot]):
            pts = np.array([[int(p[0] * w), int(p[1] * h)] for p in spot["points"]], dtype=np.int32)
        else:
            pts = np.array(spot["points"], dtype=np.int32)
        color = (0, 0, 255) if status.get(spot["id"]) == "occupied" else (0, 255, 0)
        cv2.polylines(frame, [pts], True, color, 2)
        cx, cy = pts[:, 0].mean().astype(int), pts[:, 1].mean().astype(int)
        cv2.putText(frame, spot["id"], (cx - 10, cy), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, color, 2)
    return frame


def fetch_ipcam_frame(url, timeout=3):
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


def run_ipcam(url, fps, spots, model, args):
    print(f"Starting IP Webcam stream: {url}")
    is_snapshot_url = url.endswith("/shot.jpg") or "/shot" in url or "snapshot" in url
    window_name = "Parking Spot Status (IP Webcam)"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    last_fetch = 0
    last_check = 0
    status = {}
    try:
        while True:
            now = time.time()
            frame = None

            if is_snapshot_url:
                if now - last_fetch >= 1.0 / fps:
                    frame = fetch_ipcam_frame(url)
                    last_fetch = now
            else:
                cap = cv2.VideoCapture(url)
                if not cap.isOpened():
                    print(f"Could not open IP Webcam stream: {url}")
                    return
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        print("Stream ended or frame not received.")
                        cap.release()
                        return
                    if now - last_check >= args.interval:
                        break

            if frame is not None and now - last_check >= args.interval:
                status = check_spots(frame, spots, model)
                with open(args.output, "w") as f:
                    json.dump(status, f, indent=2)
                print(json.dumps(status))
                last_check = now

            if frame is not None and args.show:
                debug_frame = draw_debug(frame.copy(), spots, status if status else {})
                debug_frame, scale, win_w, win_h = fit_frame_to_screen(debug_frame)
                cv2.resizeWindow(window_name, win_w, win_h)
                cv2.imshow(window_name, debug_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
    except KeyboardInterrupt:
        pass
    finally:
        cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", help="Path to a single still image to test on")
    parser.add_argument("--video", help="Path to video file, or camera index (e.g. 0), or RTSP URL")
    parser.add_argument("--ipcam", help="IP Webcam URL, e.g. http://192.168.1.100:8080/shot.jpg or /video")
    parser.add_argument("--ipcam-fps", type=float, default=5.0, help="FPS for IP Webcam snapshot mode")
    parser.add_argument("--spots", default="spots.json", help="Path to spots.json from mark_spots.py")
    parser.add_argument("--output", default="status.json", help="Where to write occupancy JSON")
    parser.add_argument("--interval", type=float, default=5.0,
                         help="Seconds between checks when running on --video")
    parser.add_argument("--show", action="store_true", help="Show a debug window with boxes drawn")
    parser.add_argument("--classes", default="", help="Comma-separated class names to count as vehicles, e.g. 'toy_car,car'")
    args = parser.parse_args()

    if args.classes:
        global VEHICLE_CLASS_NAMES
        VEHICLE_CLASS_NAMES = set(c.strip() for c in args.classes.split(",") if c.strip())

    with open(args.spots) as f:
        data = json.load(f)

    if isinstance(data, dict):
        spots = data.get("spots", [])
    else:
        spots = data

    print(f"Loading YOLOv8 model from yolov8m.pt (first run may download weights)...")
    model = YOLO("yolov8m.pt")

    if args.image:
        frame = cv2.imread(args.image)
        if frame is None:
            print(f"Could not read image: {args.image}")
            return
        status = check_spots(frame, spots, model)
        print(json.dumps(status, indent=2))
        with open(args.output, "w") as f:
            json.dump(status, f, indent=2)
        if args.show:
            debug_frame = draw_debug(frame.copy(), spots, status)
            debug_frame, scale, win_w, win_h = fit_frame_to_screen(debug_frame)
            window_name = "Parking Spot Status"
            cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
            cv2.resizeWindow(window_name, win_w, win_h)
            cv2.imshow(window_name, debug_frame)
            cv2.waitKey(0)
            cv2.destroyAllWindows()
        return

    if args.video is not None:
        source = int(args.video) if args.video.isdigit() else args.video
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            print(f"Could not open video source: {args.video}")
            return

        print("Running continuously. Press Ctrl+C to stop.")
        last_check = 0
        window_name = "Parking Spot Status"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("Stream ended or frame not received.")
                    break

                now = time.time()
                if now - last_check >= args.interval:
                    status = check_spots(frame, spots, model)
                    with open(args.output, "w") as f:
                        json.dump(status, f, indent=2)
                    print(json.dumps(status))
                    last_check = now

                if args.show:
                    debug_frame = draw_debug(frame.copy(), spots, status if 'status' in dir() else {})
                    debug_frame, scale, win_w, win_h = fit_frame_to_screen(debug_frame)
                    cv2.resizeWindow(window_name, win_w, win_h)
                    cv2.imshow(window_name, debug_frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
        except KeyboardInterrupt:
            pass
        finally:
            cap.release()
            cv2.destroyAllWindows()
        return

    if args.ipcam is not None:
        run_ipcam(args.ipcam, args.ipcam_fps, spots, model, args)
        return

    print("Please provide either --image, --video, or --ipcam. See --help.")


if __name__ == "__main__":
    main()
