import os
import json
import datetime
import sqlite3

import jwt
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import init_db, get_db

# ─── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get('JWT_SECRET', 'aether-pilot-secret-change-in-prod')
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ─── Auth Helpers ───────────────────────────────────────────────────────────────
def make_token(user_id: int) -> str:
    payload = {
        'sub': str(user_id),
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def require_auth():
    """Returns user_id from Bearer token, or raises with error response."""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Missing or invalid token'}), 401
    token = auth.split(' ', 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return int(payload['sub']), None, None
    except jwt.ExpiredSignatureError:
        return None, jsonify({'error': 'Token expired, please log in again'}), 401
    except jwt.InvalidTokenError:
        return None, jsonify({'error': 'Invalid token'}), 401

# ─── Routes ─────────────────────────────────────────────────────────────────────

@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory(STATIC_DIR, 'dashboard.html')

@app.route('/')
def serve_index():
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    full = os.path.join(STATIC_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(STATIC_DIR, path)
    # SPA fallback
    return send_from_directory(STATIC_DIR, 'index.html')


# ── Register ──────────────────────────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    name     = (data.get('name') or '').strip()
    email    = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    pw_hash = generate_password_hash(password)
    try:
        with get_db() as conn:
            cur = conn.execute(
                'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
                (name, email, pw_hash)
            )
            conn.commit()
            user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({'error': 'An account with that email already exists'}), 409

    token = make_token(user_id)
    return jsonify({'token': token, 'user': {'id': user_id, 'name': name, 'email': email}}), 201


# ── Login ─────────────────────────────────────────────────────────────────────
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email    = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    with get_db() as conn:
        row = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()

    if not row or not check_password_hash(row['password'], password):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = make_token(row['id'])
    return jsonify({
        'token': token,
        'user': {'id': row['id'], 'name': row['name'], 'email': row['email']}
    })


# ── Current User ──────────────────────────────────────────────────────────────
@app.route('/api/me', methods=['GET'])
def me():
    user_id, err, code = require_auth()
    if err:
        return err, code

    with get_db() as conn:
        row = conn.execute('SELECT id, name, email, created_at FROM users WHERE id = ?', (user_id,)).fetchone()

    if not row:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'user': dict(row)})


# ── Save Analysis ─────────────────────────────────────────────────────────────
@app.route('/api/analyses', methods=['POST'])
def save_analysis():
    user_id, err, code = require_auth()
    if err:
        return err, code

    data = request.get_json(silent=True) or {}
    analysis = data.get('analysis')
    if not analysis:
        return jsonify({'error': 'No analysis data provided'}), 400

    role     = analysis.get('role', 'Unknown Role')
    score    = analysis.get('readiness_score', 0)
    category = analysis.get('category', '')

    with get_db() as conn:
        cur = conn.execute(
            'INSERT INTO analyses (user_id, role, score, category, data) VALUES (?, ?, ?, ?, ?)',
            (user_id, role, score, category, json.dumps(analysis))
        )
        conn.commit()
        analysis_id = cur.lastrowid

    return jsonify({'id': analysis_id, 'message': 'Analysis saved successfully'}), 201


# ── List Analyses ─────────────────────────────────────────────────────────────
@app.route('/api/analyses', methods=['GET'])
def list_analyses():
    user_id, err, code = require_auth()
    if err:
        return err, code

    with get_db() as conn:
        rows = conn.execute(
            'SELECT id, role, score, category, created_at FROM analyses WHERE user_id = ? ORDER BY created_at DESC',
            (user_id,)
        ).fetchall()

    return jsonify({'analyses': [dict(r) for r in rows]})


# ── Get Single Analysis ───────────────────────────────────────────────────────
@app.route('/api/analyses/<int:analysis_id>', methods=['GET'])
def get_analysis(analysis_id):
    user_id, err, code = require_auth()
    if err:
        return err, code

    with get_db() as conn:
        row = conn.execute(
            'SELECT * FROM analyses WHERE id = ? AND user_id = ?',
            (analysis_id, user_id)
        ).fetchone()

    if not row:
        return jsonify({'error': 'Analysis not found'}), 404

    result = dict(row)
    result['data'] = json.loads(result['data'])
    return jsonify(result)


# ── Delete Analysis ───────────────────────────────────────────────────────────
@app.route('/api/analyses/<int:analysis_id>', methods=['DELETE'])
def delete_analysis(analysis_id):
    user_id, err, code = require_auth()
    if err:
        return err, code

    with get_db() as conn:
        conn.execute(
            'DELETE FROM analyses WHERE id = ? AND user_id = ?',
            (analysis_id, user_id)
        )
        conn.commit()

    return jsonify({'message': 'Deleted'})


# ─── Start ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    print(f"[Server] Serving frontend from: {STATIC_DIR}")
    print("[Server] Starting on http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
