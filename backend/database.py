import os
import logging
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Initialize the SQLAlchemy object
db = SQLAlchemy()

class User(db.Model):
    """
    User model representing registration and authentication details.
    """
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # One-to-many relationship with Analysis
    analyses = db.relationship('Analysis', backref='user', cascade="all, delete-orphan", lazy=True)

    def to_dict(self):
        """
        Serializes user details for client responses.
        """
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class Analysis(db.Model):
    """
    Analysis model representing a saved career evaluation.
    """
    __tablename__ = 'analyses'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role = db.Column(db.String(100), nullable=True)
    score = db.Column(db.Integer, nullable=True)
    category = db.Column(db.String(100), nullable=True)
    data = db.Column(db.Text, nullable=False)  # JSON serialized string
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        """
        Serializes analysis metadata for client listing.
        """
        return {
            'id': self.id,
            'user_id': self.user_id,
            'role': self.role,
            'score': self.score,
            'category': self.category,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

def init_db(app):
    """
    Configures SQLAlchemy database URI and initializes the database tables.
    """
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        logging.error("[DB] DATABASE_URL environment variable is missing!")
        raise RuntimeError("DATABASE_URL environment variable is required to start the application.")

    # SQLAlchemy 1.4+ does not support 'postgres://' URIs, convert to 'postgresql://' if necessary
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)

    try:
        with app.app_context():
            db.create_all()
            logging.info("[DB] PostgreSQL database connection established and tables verified/created.")
    except Exception as e:
        logging.error(f"[DB] Failed to connect or initialize PostgreSQL database: {e}")
        raise
