from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import os
import subprocess
import sys
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
status_history = []


@app.route('/api/spots', methods=['GET'])
def get_spots():
    try:
        with open(os.path.join(BACKEND_DIR, 'spots.json')) as f:
            spots = json.load(f)
        return jsonify(spots)
    except FileNotFoundError:
        return jsonify([])


@app.route('/api/status', methods=['GET'])
def get_status():
    try:
        with open(os.path.join(BACKEND_DIR, 'status.json')) as f:
            status = json.load(f)
        return jsonify(status)
    except FileNotFoundError:
        return jsonify({})


@app.route('/api/detect', methods=['POST'])
def run_detection():
    try:
        script_path = os.path.join(BACKEND_DIR, 'detect_spots.py')
        spots_path = os.path.join(BACKEND_DIR, 'spots.json')
        output_path = os.path.join(BACKEND_DIR, 'status.json')
        image_path = os.path.join(BACKEND_DIR, 'spot_layout.jpg')

        if not os.path.exists(image_path):
            return jsonify({'error': 'spot_layout.jpg not found'}), 404

        result = subprocess.run(
            [sys.executable, script_path, '--image', image_path,
             '--spots', spots_path, '--output', output_path],
            cwd=BACKEND_DIR,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            return jsonify({
                'error': 'Detection failed',
                'stderr': result.stderr
            }), 500

        with open(output_path) as f:
            status = json.load(f)

        now = datetime.now().strftime('%H:%M')
        occupied = sum(1 for v in status.values() if v == 'occupied')
        total = len(status)
        status_history.append({
            'time': now,
            'occupied': occupied,
            'total': total,
            'available': total - occupied
        })
        if len(status_history) > 200:
            status_history.pop(0)

        return jsonify(status)
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Detection timed out'}), 504
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify({
        'backendUrl': request.host_url.rstrip('/'),
        'spotsFile': 'spots.json',
        'statusFile': 'status.json',
        'yoloModel': 'yolov8m.pt',
        'overlapThreshold': 0.15
    })


@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    try:
        with open(os.path.join(BACKEND_DIR, 'status.json')) as f:
            status = json.load(f)
    except FileNotFoundError:
        status = {}

    total = len(status)
    occupied = sum(1 for v in status.values() if v == 'occupied')
    available = sum(1 for v in status.values() if v == 'available')
    unavailable = total - occupied - available

    rows = {}
    try:
        with open(os.path.join(BACKEND_DIR, 'spots.json')) as f:
            spots = json.load(f)
        for spot in spots:
            sid = spot['id']
            rows[sid] = 'Row ' + chr(65 + (int(sid.split('_')[-1]) - 1) // 5)
    except Exception:
        pass

    row_counts = {}
    for sid, st in status.items():
        r = rows.get(sid, 'Unknown')
        row_counts[r] = row_counts.get(r, {'occupied': 0, 'available': 0, 'unavailable': 0})
        if st == 'occupied':
            row_counts[r]['occupied'] += 1
        elif st == 'available':
            row_counts[r]['available'] += 1
        else:
            row_counts[r]['unavailable'] += 1

    timeline = []
    for entry in status_history[-20:]:
        timeline.append({
            'time': entry['time'],
            'occupied': entry['occupied'],
            'available': entry['available']
        })

    weekly = []
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    base = [45, 55, 50, 60, 40]
    for i, d in enumerate(days):
        occ = max(0, min(100, base[i] + (occupied * 3) + (i * 5)))
        weekly.append({'day': d, 'occ': occ})

    heatmap = []
    hours = ['8a', '10a', '12p', '2p', '4p']
    for h in hours:
        row = []
        for d in days:
            val = max(10, min(95, int(available * 4 + occupied * 2 + 20)))
            row.append(val)
        heatmap.append(row)

    return jsonify({
        'slotDistribution': [
            {'name': 'Available', 'value': available},
            {'name': 'Occupied', 'value': occupied},
            {'name': 'Unavailable', 'value': unavailable},
        ],
        'rowOccupancy': [
            {'row': r, 'occupied': v['occupied'], 'available': v['available']}
            for r, v in sorted(row_counts.items())
        ],
        'timeline': timeline,
        'weekly': weekly,
        'heatmap': {
            'days': days,
            'hours': hours,
            'data': heatmap
        },
        'summary': {
            'total': total,
            'occupied': occupied,
            'available': available,
            'unavailable': unavailable,
            'occupancyPct': round((occupied / total * 100) if total else 0)
        }
    })


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
