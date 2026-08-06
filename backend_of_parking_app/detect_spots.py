"""
detect_spots.py

Detects cars in an image/frame using a pretrained YOLOv8 model, then checks
each parking spot (defined in spots.json, created by mark_spots.py) to see
whether a car is parked in it.

SETUP (run once):
    pip install ultralytics opencv-python --break-system-packages

HOW TO USE (single image test):
    python detect_spots.py --image current_frame.jpg --spots spots.json

HOW TO USE (continuous, e.g. from a video file or RTSP camera stream):
    python detect_spots.py --video 0 --spots spots.json --interval 5
    (use --video rtsp://... for an IP camera, or a path to a video file)

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
from ultralytics import YOLO

# Classes in the COCO dataset (what YOLOv8's default weights are trained on)
# that count as "a vehicle occupying a spot"
VEHICLE_CLASS_NAMES = {"car", "truck", "bus", "motorcycle"}

# How much a detected vehicle box must overlap a spot polygon to count as "occupied"
OVERLAP_THRESHOLD = 0.15


def polygon_mask(shape, points):
    mask = np.zeros(shape[:2], dtype=np.uint8)
    cv2.fillPoly(mask, [np.array(points, dtype=np.int32)], 1)
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
    for spot in spots:
        pts = np.array(spot["points"], dtype=np.int32)
        color = (0, 0, 255) if status[spot["id"]] == "occupied" else (0, 255, 0)
        cv2.polylines(frame, [pts], True, color, 2)
        cx, cy = pts[:, 0].mean().astype(int), pts[:, 1].mean().astype(int)
        cv2.putText(frame, spot["id"], (cx - 10, cy), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, color, 2)
    return frame


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", help="Path to a single still image to test on")
    parser.add_argument("--video", help="Path to video file, or camera index (e.g. 0), or RTSP URL")
    parser.add_argument("--spots", default="spots.json", help="Path to spots.json from mark_spots.py")
    parser.add_argument("--output", default="status.json", help="Where to write occupancy JSON")
    parser.add_argument("--interval", type=float, default=5.0,
                         help="Seconds between checks when running on --video")
    parser.add_argument("--show", action="store_true", help="Show a debug window with boxes drawn")
    args = parser.parse_args()

    with open(args.spots) as f:
        spots = json.load(f)

    print("Loading YOLOv8 model (first run will download weights)...")
    model = YOLO("yolov8m.pt")  # small/fast model, good enough for this use case

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
            cv2.imshow("Parking Spot Status", debug_frame)
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
                    cv2.imshow("Parking Spot Status", debug_frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
        except KeyboardInterrupt:
            pass
        finally:
            cap.release()
            cv2.destroyAllWindows()
        return

    print("Please provide either --image or --video. See --help.")


if __name__ == "__main__":
    main()
