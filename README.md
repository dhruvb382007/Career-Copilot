# AI Career Copilot 🚀

AI Career Copilot is a web application designed to help students and job seekers become job-ready. By analyzing a user's resume against their target job role, the app leverages the Gemini API to generate a personalized career plan, track skill gaps, build visual roadmaps, suggest projects, and recommend tailored job roles. The user's analysis history is saved securely to a dashboard.

---

## 📂 Project Structure

The codebase is segregated into two clean directories:

```text
career-copilot/
├── backend/                  # Python Flask API & Database
│   ├── database.py           # SQLite database setup & helper methods
│   ├── server.py             # Flask API endpoints and static file server
│   ├── requirements.txt      # Python dependencies
│   └── career_copilot.db     # SQLite database file (generated automatically)
│
├── frontend/                 # Frontend application
│   ├── index.html            # Entrypoint (Landing / Auth / Analysis page)
│   ├── dashboard.html        # Dashboard showing saved analyses
│   ├── app.js                # Frontend core logic & Gemini API integration
│   ├── style.css             # Vanilla CSS custom design & animations
│   └── .stitch/              # Stitch configuration (if applicable)
│
└── README.md                 # Project documentation
```

---

## 🛠️ Tech Stack

### Frontend
- **HTML5 & CSS3**: Custom styling, responsive layouts, glassmorphic UI, modern typography (Outfit & Inter via Google Fonts), and custom interactive micro-animations.
- **JavaScript (Vanilla)**: DOM manipulation, history state handling, auth flows, and direct integration with the Gemini API.

### Backend
- **Python (Flask)**: Serves the REST API endpoints and hosts the static frontend files.
- **SQLite**: Lightweight database to persist user accounts and saved analysis records.
- **PyJWT & Werkzeug**: Handles secure JWT token-based authentication and password hashing.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Python 3.x** installed on your system.

### 1. Install Dependencies
Navigate to the root directory and install the required backend Python packages:

```bash
pip install -r backend/requirements.txt
```

### 2. Run the Application
Start the Flask backend server:

```bash
python backend/server.py
```

Upon starting, the script will:
- Automatically initialize the SQLite database (`backend/career_copilot.db`).
- Serve the static frontend assets from the `frontend` folder.
- Start the server at **[http://localhost:5000](http://localhost:5000)**.

### 3. Open in Browser
Once the server is running, open your web browser and go to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 💡 Key Features
- **User Authentication**: Secure signup and login with hashed passwords and JWT tokens.
- **AI Career Analysis**: Paste your resume text and target role to get a comprehensive evaluation.
- **Gemini API Integration**: Leverages Gemini models dynamically using your own API key.
- **Actionable Roadmap**: Custom step-by-step phases to transition to your target role.
- **Personalized Projects**: Detailed project ideas to build to close identified skill gaps.
- **Saved History**: Save your analyses to your dashboard to review or delete them later.
- **Data Portability**: Download your career analysis report as a formatted JSON file.
