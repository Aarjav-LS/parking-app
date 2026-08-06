"""
mark_spots.py

Interactive tool to define parking spot regions on a still image from your camera.

HOW TO USE:
1. Take one clear still photo from your parking-lot camera (e.g. spot_layout.jpg).
2. Run: python mark_spots.py spot_layout.jpg
3. For EACH parking spot:
   - Click the 4 corners of the spot (in any order around the rectangle,
     e.g. top-left -> top-right -> bottom-right -> bottom-left)
   - After the 4th click, the spot is saved and a new one begins automatically
4. Press 's' to save all spots to spots.json
5. Press 'u' to undo the last point (in case you misclick)
6. Press 'q' to quit without saving

OUTPUT:
spots.json — a list of parking spots, each with an id and 4 (x, y) corner points.
This file is what detect_spots.py will use later to check occupancy.
"""

import cv2
import json
import sys
import os

POINTS_PER_SPOT = 4


def main():
    if len(sys.argv) < 2:
        print("Usage: python mark_spots.py <image_path> [output_json]")
        sys.exit(1)

    image_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "spots.json"

    if not os.path.exists(image_path):
        print(f"Error: image not found at {image_path}")
        sys.exit(1)

    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: could not read image at {image_path}")
        sys.exit(1)

    clone = image.copy()
    spots = []            # finished spots: list of {"id": ..., "points": [[x,y]*4]}
    current_points = []   # points for the spot currently being drawn
    spot_counter = [1]    # mutable counter for spot ids

    window_name = "Mark Parking Spots (click 4 corners per spot | s=save u=undo q=quit)"

    def redraw():
        display = clone.copy()
        # draw completed spots
        for spot in spots:
            pts = spot["points"]
            for i in range(len(pts)):
                cv2.line(display, tuple(pts[i]), tuple(pts[(i + 1) % len(pts)]), (0, 255, 0), 2)
            cx = sum(p[0] for p in pts) // len(pts)
            cy = sum(p[1] for p in pts) // len(pts)
            cv2.putText(display, spot["id"], (cx - 10, cy), cv2.FONT_HERSHEY_SIMPLEX,
                        0.6, (0, 255, 0), 2)
        # draw in-progress spot
        for i, p in enumerate(current_points):
            cv2.circle(display, tuple(p), 4, (0, 0, 255), -1)
            if i > 0:
                cv2.line(display, tuple(current_points[i - 1]), tuple(p), (0, 0, 255), 2)
        cv2.imshow(window_name, display)

    def on_click(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            current_points.append([x, y])
            if len(current_points) == POINTS_PER_SPOT:
                spot_id = f"spot_{spot_counter[0]}"
                spots.append({"id": spot_id, "points": current_points.copy()})
                spot_counter[0] += 1
                current_points.clear()
            redraw()

    cv2.namedWindow(window_name)
    cv2.setMouseCallback(window_name, on_click)
    redraw()

    print("Click 4 corners per parking spot. Press 's' to save, 'u' to undo a point, 'q' to quit.")

    while True:
        key = cv2.waitKey(20) & 0xFF

        if key == ord('s'):
            with open(output_path, "w") as f:
                json.dump(spots, f, indent=2)
            print(f"Saved {len(spots)} spots to {output_path}")

        elif key == ord('u'):
            if current_points:
                current_points.pop()
            elif spots:
                spots.pop()
                spot_counter[0] -= 1
            redraw()

        elif key == ord('q'):
            break

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
