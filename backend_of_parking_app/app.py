from flask import Flask, jsonify, request, make_response
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
status_history_path = os.path.join(BACKEND_DIR, 'status_history.json')
try:
    with open(status_history_path) as f:
        status_history = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    status_history = []
vehicle_logs = []


@app.route('/api/spots', methods=['GET'])
def get_spots():
    try:
        with open(os.path.join(BACKEND_DIR, 'spots.json')) as f:
            data = json.load(f)
        if isinstance(data, dict):
            spots = data.get('spots', [])
        else:
            spots = data
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
            new_status = json.load(f)

        old_status = {}
        try:
            with open(os.path.join(BACKEND_DIR, 'status.json')) as f:
                old_status = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            pass

        now_str = datetime.now().strftime('%H:%M')
        today_str = datetime.now().strftime('%Y-%m-%d')

        logs_path = os.path.join(BACKEND_DIR, 'vehicle_logs.json')
        try:
            with open(logs_path) as f:
                logs = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            logs = []

        users_path = os.path.join(BACKEND_DIR, 'users.json')
        try:
            with open(users_path) as f:
                users = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            users = []

        user_map = {}
        for u in users:
            user_map[u.get('vehicle', '')] = u.get('name', 'Unknown')
            user_map[u.get('collegeId', '')] = u.get('name', 'Unknown')

        for spot_id, new_state in new_status.items():
            old_state = old_status.get(spot_id, 'available')
            if new_state != old_state:
                plate = spot_id
                owner = user_map.get(spot_id, 'Unknown')
                if new_state == 'occupied':
                    log = {
                        'id': f"VL-{int(time.time() * 1000)}_{spot_id}",
                        'vehicle': plate,
                        'owner': owner,
                        'type': 'Car',
                        'entry': now_str,
                        'exit': '-',
                        'duration': '-',
                        'slot': spot_id,
                        'status': 'Parked',
                        'date': today_str
                    }
                else:
                    entry_time = '-'
                    for existing in reversed(logs):
                        if existing.get('slot') == spot_id and existing.get('status') == 'Parked':
                            entry_time = existing.get('entry', '-')
                            break
                    log = {
                        'id': f"VL-{int(time.time() * 1000)}_{spot_id}",
                        'vehicle': plate,
                        'owner': owner,
                        'type': 'Car',
                        'entry': entry_time,
                        'exit': now_str,
                        'duration': '-',
                        'slot': spot_id,
                        'status': 'Exited',
                        'date': today_str
                    }
                logs.append(log)
            elif new_state == 'occupied' and old_state == 'available' and not logs:
                plate = spot_id
                owner = user_map.get(spot_id, 'Unknown')
                log = {
                    'id': f"VL-{int(time.time() * 1000)}_{spot_id}",
                    'vehicle': plate,
                    'owner': owner,
                    'type': 'Car',
                    'entry': now_str,
                    'exit': '-',
                    'duration': '-',
                    'slot': spot_id,
                    'status': 'Parked',
                    'date': today_str
                }
                logs.append(log)

        with open(logs_path, 'w') as f:
            json.dump(logs[-500:], f, indent=2)

        now = datetime.now().strftime('%H:%M')
        occupied = sum(1 for v in new_status.values() if v == 'occupied')
        total = len(new_status)
        status_history.append({
            'time': now,
            'occupied': occupied,
            'total': total,
            'available': total - occupied
        })
        if len(status_history) > 200:
            status_history.pop(0)

        try:
            with open(status_history_path, 'w') as f:
                json.dump(status_history, f, indent=2)
        except Exception:
            pass

        return jsonify(new_status)
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
        'usersFile': 'users.json',
        'yoloModel': 'yolov8n.pt',
        'overlapThreshold': 0.15
    })


@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        with open(os.path.join(BACKEND_DIR, 'users.json')) as f:
            users = json.load(f)
        return make_response(json.dumps(users), 200, {'Content-Type': 'application/json'})
    except FileNotFoundError:
        return make_response(json.dumps([]), 200, {'Content-Type': 'application/json'})


@app.route('/api/register', methods=['POST'])
def register_user():
    try:
        data = request.get_json()
        users_path = os.path.join(BACKEND_DIR, 'users.json')
        try:
            with open(users_path) as f:
                users = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            users = []
        new_user = {
            'id': f"U-{int(time.time())}",
            'name': data.get('name', ''),
            'email': data.get('email', ''),
            'collegeId': data.get('collegeId', ''),
            'phone': data.get('phone', ''),
            'vehicle': data.get('vehicle', ''),
            'type': data.get('type', 'Car'),
            'status': 'Active'
        }
        users.append(new_user)
        with open(users_path, 'w') as f:
            json.dump(users, f, indent=2)
        return jsonify(new_user)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/vehicle-logs', methods=['GET'])
def get_vehicle_logs():
    try:
        logs_path = os.path.join(BACKEND_DIR, 'vehicle_logs.json')
        try:
            with open(logs_path) as f:
                logs = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            logs = []
        logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        return make_response(json.dumps(logs), 200, {'Content-Type': 'application/json'})
    except Exception as e:
        return make_response(json.dumps([]), 200, {'Content-Type': 'application/json'})


@app.route('/api/vehicle-logs', methods=['POST'])
def add_vehicle_log():
    try:
        data = request.get_json()
        logs_path = os.path.join(BACKEND_DIR, 'vehicle_logs.json')
        try:
            with open(logs_path) as f:
                logs = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            logs = []
        logs.append(data)
        with open(logs_path, 'w') as f:
            json.dump(logs, f, indent=2)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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

    if not timeline:
        now = datetime.now().strftime('%H:%M')
        timeline.append({
            'time': now,
            'occupied': occupied,
            'available': available
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

    hourly = []
    hour_buckets = {}
    for entry in status_history:
        try:
            h = datetime.strptime(entry['time'], '%H:%M').hour
        except Exception:
            continue
        if h not in hour_buckets:
            hour_buckets[h] = []
        pct = entry.get('occupancyPct')
        if pct is None:
            pct = round((entry.get('occupied', 0) / entry.get('total', 1)) * 100) if entry.get('total') else 0
        hour_buckets[h].append(pct)
    for h in range(6, 22):
        vals = hour_buckets.get(h, [])
        avg = round(sum(vals) / len(vals)) if vals else 0
        ampm = 'a' if h < 12 else 'p'
        hour12 = h if h <= 12 else h - 12
        if hour12 == 0:
            hour12 = 12
        label = f"{hour12}{ampm}"
        hourly.append({'hour': label, 'occupancy': avg})

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
        'hourly': hourly,
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
