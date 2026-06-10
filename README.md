# AI Career Copilot 🚀

AI Career Copilot is a web application designed to help students and job seekers become job-ready. By analyzing a user's resume against their target job role, the app leverages the Gemini API to generate a personalized career plan, track skill gaps, build visual roadmaps, suggest projects, and recommend tailored job roles. The user's analysis history is saved securely to a dashboard.

---

## 📂 Project Structure

The codebase is segregated into two clean directories for seamless independent deployment:

```text
career-copilot/
├── backend/                  # Python Flask API & Database
│   ├── database.py           # SQLite database setup & helper methods
│   ├── server.py             # Flask API endpoints and static file server
│   └── requirements.txt      # Python dependencies
│
├── frontend/                 # Frontend application (Vercel Ready)
│   ├── index.html            # Entrypoint (Landing / Auth / Analysis page)
│   ├── dashboard.html        # Dashboard showing saved analyses
│   ├── app.js                # Frontend core logic & Gemini API integration
│   └── style.css             # Vanilla CSS custom design & animations
│
├── .env.example              # Sample environment variables
├── .gitignore                # Ignored files for Git
├── Procfile                  # Railway / Heroku deployment config
└── README.md                 # Project documentation
```

---

## 🛠️ Tech Stack

### Frontend
- **HTML5 & CSS3**: Custom styling, responsive layouts, glassmorphic UI, modern typography, and custom interactive micro-animations.
- **JavaScript (Vanilla)**: DOM manipulation, history state handling, auth flows, and direct integration with the Gemini API.

### Backend
- **Python (Flask)**: Serves the REST API endpoints and hosts the static frontend files.
- **SQLite**: Lightweight database to persist user accounts and saved analysis records (Structured for easy PostgreSQL migration).
- **PyJWT & Werkzeug**: Handles secure JWT token-based authentication and password hashing.
- **Gunicorn**: Production WSGI server used by Railway.

---

## 🚀 Getting Started Locally

### Prerequisites
Make sure you have **Python 3.x** installed.

### 1. Environment Setup
Create a `.env` file at the root of the project by copying `.env.example`:

```bash
cp .env.example .env
```

Ensure it contains your JWT secret and allowed origins:
```env
PORT=5000
JWT_SECRET=your-secure-jwt-secret
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:3000
```

### 2. Install Dependencies
Navigate to the root directory and install the required backend Python packages:

```bash
pip install -r backend/requirements.txt
```

### 3. Run the Application
Start the Flask backend server:

```bash
python backend/server.py
```

Upon starting, the script will:
- Automatically initialize the SQLite database (`backend/career_copilot.db`).
- Serve the static frontend assets from the `frontend` folder.
- Start the server at **[http://localhost:5000](http://localhost:5000)**.

---

## 🌍 Production Deployment Guide

### 1. Backend (Railway)
1. Push your code to a GitHub repository.
2. Sign in to [Railway.app](https://railway.app/).
3. Create a New Project -> Deploy from GitHub repo.
4. Select your `career-copilot` repository.
5. In the Railway dashboard for the service, go to **Variables** and add:
   - `JWT_SECRET`: A strong secret string.
   - `ALLOWED_ORIGINS`: The URL of your future Vercel frontend (e.g., `https://career-copilot-frontend.vercel.app`).
6. Railway will automatically detect the `Procfile` and `backend/requirements.txt` and deploy the backend.
7. Note down the generated Railway Domain (e.g., `https://career-copilot-backend.up.railway.app`).

### 2. Frontend (Vercel)
1. Open `frontend/app.js` and update `PROD_API_URL` to match your new Railway backend domain.
   ```javascript
   const PROD_API_URL = 'https://career-copilot-backend.up.railway.app';
   ```
2. Sign in to [Vercel](https://vercel.com).
3. Import your GitHub repository.
4. Set the **Framework Preset** to `Other`.
5. Set the **Root Directory** to `frontend`.
6. Deploy.

---

## 📡 API Endpoints

### Authentication
- `POST /api/register` - Register a new user (Requires `name`, `email`, `password`).
- `POST /api/login` - Authenticate an existing user (Requires `email`, `password`).
- `GET /api/me` - Get current authenticated user profile (Requires `Bearer` token).

### Analyses
- `POST /api/analyses` - Save a new career analysis (Requires `Bearer` token).
- `GET /api/analyses` - List all saved analyses for the user.
- `GET /api/analyses/<id>` - Retrieve a specific saved analysis.
- `DELETE /api/analyses/<id>` - Delete a saved analysis.
