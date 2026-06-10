import os
import json
import datetime
import logging
from dotenv import load_dotenv

# Load environment variables from .env file for local development
load_dotenv()

import jwt
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import db, init_db, User, Analysis

# ─── Logging Setup ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)

# ─── Config ────────────────────────────────────────────────────────────────────
# Ensure JWT_SECRET is provided in production
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    logging.warning("JWT_SECRET environment variable is missing. Using a fallback for local development only.")
    JWT_SECRET = 'aether-pilot-secret-change-in-prod'

# Setup static directory for serving frontend files
STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')

# Configure CORS safely for production.
# Allow local dev and specific production frontend URLs.
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5000")
ALLOWED_ORIGINS = [origin.strip() for origin in allowed_origins_env.split(',') if origin.strip()]

CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})
logging.info(f"CORS Allowed Origins: {ALLOWED_ORIGINS}")

# ─── Initialization ─────────────────────────────────────────────────────────────
# Ensure DB is initialized before first request (for Gunicorn/Railway)
init_db(app)

# ─── Auth Helpers ───────────────────────────────────────────────────────────────
def make_token(user_id: int) -> str:
    payload = {
        'sub': str(user_id),
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def require_auth():
    """Returns user_id from Bearer token, or raises with error response."""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None, jsonify({'error': 'Missing or invalid authentication token'}), 401
    
    token = auth.split(' ', 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return int(payload['sub']), None, None
    except jwt.ExpiredSignatureError:
        return None, jsonify({'error': 'Token has expired. Please log in again.'}), 401
    except jwt.InvalidTokenError:
        return None, jsonify({'error': 'Invalid authentication token.'}), 401
    except Exception as e:
        logging.error(f"JWT Validation Error: {e}")
        return None, jsonify({'error': 'Authentication failed.'}), 401

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

    from sqlalchemy.exc import IntegrityError
    pw_hash = generate_password_hash(password)
    try:
        new_user = User(name=name, email=email, password=pw_hash)
        db.session.add(new_user)
        db.session.commit()
        user_id = new_user.id
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'An account with that email already exists'}), 409
    except Exception as e:
        db.session.rollback()
        logging.error(f"Registration Error: {e}")
        return jsonify({'error': 'Internal server error during registration.'}), 500

    token = make_token(user_id)
    logging.info(f"New user registered: {email}")
    return jsonify({'token': token, 'user': {'id': user_id, 'name': name, 'email': email}}), 201


# ── Login ─────────────────────────────────────────────────────────────────────
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email    = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '').strip()

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    try:
        user = User.query.filter_by(email=email).first()

        if not user or not check_password_hash(user.password, password):
            return jsonify({'error': 'Invalid email or password'}), 401

        token = make_token(user.id)
        logging.info(f"User logged in: {email}")
        return jsonify({
            'token': token,
            'user': {'id': user.id, 'name': user.name, 'email': user.email}
        })
    except Exception as e:
        logging.error(f"Login Error: {e}")
        return jsonify({'error': 'Internal server error during login.'}), 500


# ── Current User ──────────────────────────────────────────────────────────────
@app.route('/api/me', methods=['GET'])
def me():
    user_id, err, code = require_auth()
    if err:
        return err, code

    try:
        user = db.session.get(User, user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify({'user': user.to_dict()})
    except Exception as e:
        logging.error(f"Fetch User Error: {e}")
        return jsonify({'error': 'Internal server error fetching profile.'}), 500


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

    try:
        new_analysis = Analysis(
            user_id=user_id,
            role=role,
            score=score,
            category=category,
            data=json.dumps(analysis)
        )
        db.session.add(new_analysis)
        db.session.commit()
        analysis_id = new_analysis.id

        logging.info(f"Analysis saved for user {user_id}")
        return jsonify({'id': analysis_id, 'message': 'Analysis saved successfully'}), 201
    except Exception as e:
        db.session.rollback()
        logging.error(f"Save Analysis Error: {e}")
        return jsonify({'error': 'Internal server error saving analysis.'}), 500


# ── List Analyses ─────────────────────────────────────────────────────────────
@app.route('/api/analyses', methods=['GET'])
def list_analyses():
    user_id, err, code = require_auth()
    if err:
        return err, code

    try:
        analyses = Analysis.query.filter_by(user_id=user_id).order_by(Analysis.created_at.desc()).all()
        return jsonify({'analyses': [a.to_dict() for a in analyses]})
    except Exception as e:
        logging.error(f"List Analyses Error: {e}")
        return jsonify({'error': 'Internal server error listing analyses.'}), 500


# ── Get Single Analysis ───────────────────────────────────────────────────────
@app.route('/api/analyses/<int:analysis_id>', methods=['GET'])
def get_analysis(analysis_id):
    user_id, err, code = require_auth()
    if err:
        return err, code

    try:
        analysis = Analysis.query.filter_by(id=analysis_id, user_id=user_id).first()

        if not analysis:
            return jsonify({'error': 'Analysis not found'}), 404

        result = {
            'id': analysis.id,
            'user_id': analysis.user_id,
            'role': analysis.role,
            'score': analysis.score,
            'category': analysis.category,
            'data': json.loads(analysis.data),
            'created_at': analysis.created_at.strftime('%Y-%m-%d %H:%M:%S') if analysis.created_at else None
        }
        return jsonify(result)
    except Exception as e:
        logging.error(f"Get Analysis Error: {e}")
        return jsonify({'error': 'Internal server error fetching analysis.'}), 500


# ── Delete Analysis ───────────────────────────────────────────────────────────
@app.route('/api/analyses/<int:analysis_id>', methods=['DELETE'])
def delete_analysis(analysis_id):
    user_id, err, code = require_auth()
    if err:
        return err, code

    try:
        analysis = Analysis.query.filter_by(id=analysis_id, user_id=user_id).first()
        if analysis:
            db.session.delete(analysis)
            db.session.commit()

        logging.info(f"Analysis {analysis_id} deleted by user {user_id}")
        return jsonify({'message': 'Analysis deleted successfully'})
    except Exception as e:
        db.session.rollback()
        logging.error(f"Delete Analysis Error: {e}")
        return jsonify({'error': 'Internal server error deleting analysis.'}), 500


# ─── Start ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    logging.info(f"[Server] Serving frontend from: {STATIC_DIR}")
    
    # Get port from environment variable, fallback to 5000 for local dev
    port = int(os.environ.get("PORT", 5000))
    logging.info(f"[Server] Starting on port {port}")
    
    app.run(host='0.0.0.0', port=port, debug=True)
