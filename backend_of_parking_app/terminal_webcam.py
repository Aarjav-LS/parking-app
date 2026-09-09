"""
terminal_webcam.py

Streams a mobile phone camera into the terminal as live ASCII art.

SETUP:
    1. Install "IP Webcam" (Android) or "EpocCam" / any HTTP camera app on your phone.
    2. Connect your phone and PC to the SAME Wi-Fi network.
    3. Start the camera server in the app and note the URL, e.g.:
         http://192.168.1.42:8080/video   (MJPEG stream)
       or
         http://192.168.1.42:8080/shot.jpg (snapshot polling)

    4. Run this script:
         python terminal_webcam.py --url http://192.168.1.42:8080/video

    You can also use a local webcam:
         python terminal_webcam.py --local 0

CONTROLS:
    q  – quit
    f  – flip ASCII brightness (invert)
    s  – save current frame as PNG
"""

import argparse
import os
import sys
import time

# ---------- deps ----------
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

# ---------- ASCII ramp ----------
# From darkest to brightest character
ASCII_RAMP = " .:-=+*#%@"
RAMP_LEN = len(ASCII_RAMP)


def frame_to_ascii(gray_frame, width, height, invert=False):
    """Convert a grayscale frame to an ASCII string of size width x height."""
    small = cv2.resize(gray_frame, (width, height), interpolation=cv2.INTER_AREA)
    ramp = ASCII_RAMP[::-1] if invert else ASCII_RAMP
    lines = []
    for row in small:
        line = "".join(ramp[int(pixel / 255 * (RAMP_LEN - 1))] for pixel in row)
        lines.append(line)
    return "\n".join(lines)


def get_terminal_size():
    """Return (columns, rows) of the current terminal window."""
    try:
        cols, rows = os.get_terminal_size(0)
        return cols, rows
    except (OSError, ValueError):
        pass
    try:
        cols, rows = os.get_terminal_size(1)
        return cols, rows
    except (OSError, ValueError):
        pass
    return 80, 24


def hide_cursor():
    sys.stdout.write("\033[?25l")
    sys.stdout.flush()


def show_cursor():
    sys.stdout.write("\033[?25h")
    sys.stdout.flush()


def move_cursor_home():
    sys.stdout.write("\033[H")
    sys.stdout.flush()


def clear_screen():
    sys.stdout.write("\033[2J")
    sys.stdout.flush()


def fetch_frame_http(url, timeout=4):
    """Fetch a single JPEG frame from an HTTP URL (snapshot mode)."""
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


def stream_ipcam(url, fps, save_dir):
    """Stream from an IP webcam — supports MJPEG /video and snapshot /shot.jpg."""
    is_snapshot = (
        url.endswith("/shot.jpg") or
        "/shot" in url or
        "snapshot" in url
    )

    invert = False
    frame_count = 0

    if save_dir:
        os.makedirs(save_dir, exist_ok=True)

    cap = None
    if not is_snapshot:
        cap = cv2.VideoCapture(url)
        if not cap.isOpened():
            print(f"\033[1;31mCould not open stream: {url}\033[0m")
            return

    try:
        while True:
            frame = None

            if is_snapshot:
                frame = fetch_frame_http(url)
            else:
                ret, frame = cap.read()
                if not ret:
                    print("\033[1;31mStream ended.\033[0m")
                    break

            if frame is None:
                time.sleep(1.0 / fps)
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

            # Calculate ASCII size accounting for terminal character aspect ratio
            cols, rows = get_terminal_size()
            # Characters are ~2x taller than wide → halve the width
            ascii_w = max(cols - 1, 1)
            ascii_h = max(rows - 1, 1)

            ascii_art = frame_to_ascii(gray, ascii_w, ascii_h, invert=invert)

            # Overlay info on the top-right corner
            overlay = f"  [{time.strftime('%H:%M:%S')}]  q=quit  f=flip  s=save"
            lines = ascii_art.split("\n")
            if lines:
                pad = max(0, ascii_w - len(overlay) - 4)
                lines[0] = lines[0][: ascii_w - len(overlay) - pad] + (" " * pad) + overlay
            ascii_art = "\n".join(lines)

            move_cursor_home()
            sys.stdout.write(ascii_art)
            sys.stdout.flush()

            # Non-blocking key read (Windows compatible)
            if _kbhit():
                ch = _getch()
                if ch in ("q", "Q"):
                    break
                if ch in ("f", "F"):
                    invert = not invert
                if ch in ("s", "S"):
                    fname = os.path.join(
                        save_dir or BACKEND_DIR,
                        f"frame_{int(time.time())}.png"
                    )
                    cv2.imwrite(fname, frame)
                    sys.stdout.write(f"\033[1;32mSaved: {fname}\033[0m\n")
                    sys.stdout.flush()
                    time.sleep(0.5)

            frame_count += 1
            if not is_snapshot:
                # MJPEG: cap.read() controls rate; small sleep for CPU
                time.sleep(0.005)
            else:
                time.sleep(max(0, 1.0 / fps - 0.05))

    except KeyboardInterrupt:
        pass
    finally:
        if cap is not None:
            cap.release()
        show_cursor()
        clear_screen()
        move_cursor_home()


def stream_local(device_index, save_dir):
    """Stream from a locally attached webcam."""
    cap = cv2.VideoCapture(int(device_index))
    if not cap.isOpened():
        print(f"\033[1;31mCould not open camera index: {device_index}\033[0m")
        return

    invert = False
    if save_dir:
        os.makedirs(save_dir, exist_ok=True)

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("\033[1;31mCamera disconnected.\033[0m")
                break

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            cols, rows = get_terminal_size()
            ascii_w = max(cols - 1, 1)
            ascii_h = max(rows - 1, 1)
            ascii_art = frame_to_ascii(gray, ascii_w, ascii_h, invert=invert)

            overlay = f"  [{time.strftime('%H:%M:%S')}]  q=quit  f=flip  s=save"
            lines = ascii_art.split("\n")
            if lines:
                pad = max(0, ascii_w - len(overlay) - 4)
                lines[0] = lines[0][: ascii_w - len(overlay) - pad] + (" " * pad) + overlay
            ascii_art = "\n".join(lines)

            move_cursor_home()
            sys.stdout.write(ascii_art)
            sys.stdout.flush()

            if _kbhit():
                ch = _getch()
                if ch in ("q", "Q"):
                    break
                if ch in ("f", "F"):
                    invert = not invert
                if ch in ("s", "S"):
                    fname = os.path.join(
                        save_dir or BACKEND_DIR,
                        f"frame_{int(time.time())}.png"
                    )
                    cv2.imwrite(fname, frame)
                    sys.stdout.write(f"\033[1;32mSaved: {fname}\033[0m\n")
                    sys.stdout.flush()
                    time.sleep(0.5)

            time.sleep(0.03)
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        show_cursor()
        clear_screen()
        move_cursor_home()


# ---------- minimal cross-platform kbhit / getch ----------
if sys.platform == "win32":
    import msvcrt

    def _kbhit():
        return msvcrt.kbhit()

    def _getch():
        return msvcrt.getwch()
else:
    import select
    import termios
    import tty

    _fd = sys.stdin.fileno()
    _old_term = None

    def _setup_term():
        global _old_term
        _old_term = termios.tcgetattr(_fd)
        tty.setcbreak(_fd)

    def _restore_term():
        if _old_term is not None:
            termios.tcsetattr(_fd, termios.TCSADRAIN, _old_term)

    def _kbhit():
        return select.select([sys.stdin], [], [], 0)[0]

    def _getch():
        ch = sys.stdin.read(1)
        return ch


# ---------- entry point ----------
def main():
    parser = argparse.ArgumentParser(
        description="Stream a mobile / local webcam as ASCII art in the terminal."
    )
    parser.add_argument("--url", help="HTTP URL of IP webcam, e.g. http://192.168.x.x:8080/video")
    parser.add_argument("--local", help="Local webcam index, e.g. 0")
    parser.add_argument("--fps", type=float, default=10.0, help="Target FPS for snapshot mode")
    parser.add_argument("--save", default="", help="Directory to save captured PNG frames")
    args = parser.parse_args()

    if not args.url and args.local is None:
        print("Provide --url http://... or --local 0  (see --help)")
        sys.exit(1)

    hide_cursor()
    clear_screen()
    if sys.platform != "win32":
        _setup_term()

    try:
        if args.url:
            stream_ipcam(args.url, args.fps, args.save)
        else:
            stream_local(args.local, args.save)
    finally:
        if sys.platform != "win32":
            _restore_term()
        show_cursor()
        clear_screen()
        move_cursor_home()


if __name__ == "__main__":
    main()
