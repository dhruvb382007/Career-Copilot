// ===== Backend API Base URL =====
const API_BASE = window.location.port === '5000' || window.location.port === ''  
  ? window.location.origin
  : 'http://localhost:5000';

// ===== Auth State =====
let currentUser = null;

function getToken() { return localStorage.getItem('cc_token'); }
function setToken(t) { localStorage.setItem('cc_token', t); }
function clearToken() { localStorage.removeItem('cc_token'); }

async function checkAuth() {
  const token = getToken();
  if (!token) { showAuthModal(); return; }
  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { clearToken(); showAuthModal(); return; }
    const data = await res.json();
    currentUser = data.user;
    onLoggedIn(false); // already on main page, no redirect
    // Check if coming from dashboard with ?analysis=ID
    const params = new URLSearchParams(window.location.search);
    const analysisId = params.get('analysis');
    if (analysisId) {
      loadSavedAnalysis(parseInt(analysisId));
    }
  } catch {
    // Server might not be running — degrade gracefully
    showAuthModal();
  }
}

function showAuthModal(tab = 'login') {
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('navGuest').style.display = 'flex';
  document.getElementById('navUser').style.display = 'none';
  switchAuthTab(tab);
}

function hideAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function continueAsGuest() {
  hideAuthModal();
}

function onLoggedIn(redirectToDashboard = false) {
  hideAuthModal();
  document.getElementById('navGuest').style.display = 'none';
  document.getElementById('navUser').style.display = 'flex';
  document.getElementById('navName').textContent = currentUser.name;
  document.getElementById('navAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
  if (redirectToDashboard) {
    window.location.href = '/dashboard';
  }
}

// ── Tab switcher ──
function switchAuthTab(tab) {
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const active = 'auth-tab-active';

  if (tab === 'login') {
    loginTab.classList.add(active); registerTab.classList.remove(active);
    loginForm.classList.remove('hidden'); registerForm.classList.add('hidden');
  } else {
    registerTab.classList.add(active); loginTab.classList.remove(active);
    registerForm.classList.remove('hidden'); loginForm.classList.add('hidden');
  }
}

// ── Register ──
async function doRegister() {
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const errEl    = document.getElementById('registerError');
  errEl.classList.add('hidden');

  if (!name || !email || !password) { showAuthError(errEl, 'All fields are required.'); return; }

  try {
    const res = await fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(errEl, data.error || 'Registration failed.'); return; }
    setToken(data.token);
    currentUser = data.user;
    onLoggedIn();
  } catch (e) {
    showAuthError(errEl, 'Cannot connect to server. Is it running on port 5000?');
  }
}

// ── Login ──
async function doLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const errEl    = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!email || !password) { showAuthError(errEl, 'Email and password are required.'); return; }

  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(errEl, data.error || 'Login failed.'); return; }
    setToken(data.token);
    currentUser = data.user;
    onLoggedIn();
  } catch (e) {
    showAuthError(errEl, 'Cannot connect to server. Is it running on port 5000?');
  }
}

// ── Logout ──
function doLogout() {
  clearToken();
  currentUser = null;
  showAuthModal();
  resetForm();
}

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ===== Analyses Drawer =====
function toggleDrawer(open) {
  const drawer = document.getElementById('analysesDrawer');
  const overlay = document.getElementById('drawerOverlay');
  if (open) {
    drawer.classList.add('open');
    overlay.classList.remove('hidden');
    loadAnalyses();
  } else {
    drawer.classList.remove('open');
    overlay.classList.add('hidden');
  }
}

async function loadAnalyses() {
  const content = document.getElementById('drawerContent');
  content.innerHTML = '<p class="text-xs text-outline text-center py-8">Loading…</p>';
  try {
    const res = await fetch(`${API_BASE}/api/analyses`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await res.json();
    const analyses = data.analyses || [];
    if (!analyses.length) {
      content.innerHTML = '<div class="text-center py-12 space-y-3"><span class="material-symbols-outlined text-outline text-4xl">history</span><p class="text-xs text-outline">No saved analyses yet.</p><p class="text-[10px] text-outline/60">Run an analysis and click <b class="text-secondary">Save Analysis</b>.</p></div>';
      return;
    }
    content.innerHTML = '';
    analyses.forEach(a => {
      const colors = { READY: 'text-emerald-400', NEAR_READY: 'text-amber-400', NOT_READY: 'text-error' };
      const color = colors[a.category] || 'text-outline';
      const date = new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const div = document.createElement('div');
      div.className = 'history-item bg-surface-container-highest/40 border border-white/5 rounded-xl p-4 space-y-2 transition-colors';
      div.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-bold text-on-surface leading-tight">${escHtml(a.role)}</p>
          <button onclick="deleteAnalysis(${a.id}, this)" class="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center hover:bg-error/15 transition-colors" title="Delete">
            <span class="material-symbols-outlined text-outline hover:text-error text-[14px]">delete</span>
          </button>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-mono font-black text-lg ${color}">${a.score}</span>
          <span class="text-[10px] ${color} font-bold uppercase tracking-widest">${(a.category || '').replace(/_/g, ' ')}</span>
        </div>
        <p class="text-[10px] text-outline">${date}</p>`;
      div.querySelector('p:first-child, div:first-child').addEventListener && 
        div.addEventListener('click', (e) => { if (!e.target.closest('button')) loadSavedAnalysis(a.id); });
      content.appendChild(div);
    });
  } catch {
    content.innerHTML = '<p class="text-xs text-error text-center py-8">Failed to load analyses.</p>';
  }
}

async function loadSavedAnalysis(id) {
  try {
    const res = await fetch(`${API_BASE}/api/analyses/${id}`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const row = await res.json();
    lastResult = row.data;
    renderResults(row.data);
    document.getElementById('inputCard').style.display = 'none';
    document.getElementById('resultsWrapper').style.display = 'block';
    toggleDrawer(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    alert('Failed to load saved analysis.');
  }
}

async function deleteAnalysis(id, btn) {
  btn.disabled = true;
  try {
    await fetch(`${API_BASE}/api/analyses/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    loadAnalyses();
  } catch {
    btn.disabled = false;
  }
}

async function saveAnalysis() {
  if (!currentUser) {
    showAuthModal('login');
    return;
  }
  if (!lastResult) return;
  const btn = document.getElementById('saveBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> Saving…';
  try {
    const res = await fetch(`${API_BASE}/api/analyses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ analysis: lastResult })
    });
    if (res.ok) {
      btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">check_circle</span> Saved!';
      btn.className = btn.className.replace('text-secondary', 'text-emerald-400').replace('secondary-container', 'emerald-500');
      setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; }, 2500);
    } else {
      throw new Error();
    }
  } catch {
    btn.innerHTML = '<span class="material-symbols-outlined text-[16px]">error</span> Failed';
    btn.className = btn.className.replace('text-secondary', 'text-error');
    setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; btn.className = btn.className.replace('text-error', 'text-secondary'); }, 2500);
  }
}

// ===== Particles =====
(function () {
  const container = document.getElementById('bgParticles');
  const colors = ['#8083ff', '#d0bcff', '#4cd7f6', '#571bc1'];
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1.5;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration:${9 + Math.random() * 13}s;
      animation-delay:${Math.random() * 12}s;
      box-shadow: 0 0 ${size * 2}px ${colors[Math.floor(Math.random() * colors.length)]}44;
    `;
    container.appendChild(p);
  }
})();

// ===== Bootstrap =====
window.addEventListener('DOMContentLoaded', () => checkAuth());

// ===== State =====
let lastResult = null;

// ===== Sample Resume =====
const SAMPLE_RESUME = `John Doe
Email: john.doe@email.com | LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe

EDUCATION
B.Tech in Computer Science — ABC University, 2024 (CGPA: 8.1/10)

SKILLS
Languages: Python, JavaScript, HTML, CSS
Frameworks: React.js (basic), Flask
Databases: MySQL, basic MongoDB
Tools: Git, VS Code, Postman

EXPERIENCE
Web Development Intern — XYZ Corp (July 2023 – Sept 2023)
- Built a CRUD dashboard using React and Flask
- Wrote REST API endpoints for user management
- Managed MySQL database schema and migrations

PROJECTS
- Student Grade Tracker: Python + SQLite CLI app
- Portfolio Website: HTML, CSS, JS responsive site
- Weather App: Consumed a public API using fetch()

CERTIFICATIONS
- Python for Everybody – Coursera (2023)
- Responsive Web Design – freeCodeCamp (2023)

SOFT SKILLS
Problem solving, Team collaboration, Communication`;

function loadSampleResume() {
  document.getElementById('resumeText').value = SAMPLE_RESUME;
  document.getElementById('targetRole').value = 'Full Stack Developer';
}

// ===== Loading Steps Animation =====
let stepInterval = null;
function startLoadingAnimation() {
  const steps = ['step1', 'step2', 'step3', 'step4'];
  let current = 0;
  const base = 'step-item w-full text-sm py-2.5 px-4 rounded-lg border transition-all duration-400';
  steps.forEach(id => {
    document.getElementById(id).className = base + ' border-transparent text-outline';
  });
  document.getElementById(steps[0]).className = base + ' border-primary/25 bg-primary/8 text-primary';

  stepInterval = setInterval(() => {
    if (current < steps.length) {
      document.getElementById(steps[current]).className = base + ' border-emerald-500/25 bg-emerald-500/8 text-emerald-400';
      current++;
      if (current < steps.length) {
        document.getElementById(steps[current]).className = base + ' border-primary/25 bg-primary/8 text-primary';
      }
    } else {
      clearInterval(stepInterval);
    }
  }, 900);
}

function stopLoadingAnimation() {
  if (stepInterval) clearInterval(stepInterval);
}

// ===== UI State Helpers =====
function showLoading() {
  document.getElementById('inputCard').style.display = 'none';
  document.getElementById('loadingCard').style.display = 'block';
  document.getElementById('resultsWrapper').style.display = 'none';
  document.getElementById('errorCard').style.display = 'none';
  startLoadingAnimation();
}

function showResults() {
  document.getElementById('loadingCard').style.display = 'none';
  document.getElementById('resultsWrapper').style.display = 'block';
  stopLoadingAnimation();
}

function showError(msg) {
  stopLoadingAnimation();
  document.getElementById('loadingCard').style.display = 'none';
  document.getElementById('inputCard').style.display = 'block';
  document.getElementById('errorCard').style.display = 'flex';
  document.getElementById('errorText').textContent = msg;
}

function hideError() {
  document.getElementById('errorCard').style.display = 'none';
}

function resetForm() {
  document.getElementById('resultsWrapper').style.display = 'none';
  document.getElementById('inputCard').style.display = 'block';
  document.getElementById('errorCard').style.display = 'none';
}

// ===== Model Selector =====
function onApiKeyChange() {
  // Only auto-fetch if key looks complete (starts with AIza and is long enough)
  const key = document.getElementById('apiKey').value.trim();
  if (key.startsWith('AIza') && key.length > 30) {
    fetchAvailableModels();
  }
}

async function fetchAvailableModels() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) {
    alert('Please enter your API key first.');
    return;
  }

  const btn = document.getElementById('fetchModelsBtn');
  const icon = document.getElementById('fetchModelsBtnIcon');
  const select = document.getElementById('modelSelect');

  // Loading state
  btn.disabled = true;
  icon.style.animation = 'spin 1s linear infinite';
  icon.textContent = 'sync';

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const models = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name.replace('models/', ''));

    if (!models.length) throw new Error('No generateContent models found for this key.');

    // Repopulate select
    select.innerHTML = '';
    models.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      // Highlight 2.5 flash as recommended
      opt.textContent = name + (name.includes('2.5') ? ' ✦ recommended' : '');
      select.appendChild(opt);
    });

    // Auto-select first 2.5-flash model if available, else first
    const preferred = models.find(m => m.includes('2.5-flash')) || models[0];
    select.value = preferred;

    icon.textContent = 'check_circle';
    icon.style.animation = '';
    icon.style.color = '#4cd7f6';
  } catch (err) {
    icon.textContent = 'error';
    icon.style.animation = '';
    icon.style.color = '#ffb4ab';
    select.innerHTML = `<option value="gemini-2.5-flash-preview-04-17">Error fetching — using default</option>`;
    console.error('Fetch models error:', err.message);
  } finally {
    btn.disabled = false;
    // Reset icon after 3s
    setTimeout(() => {
      icon.textContent = 'refresh';
      icon.style.color = '';
    }, 3000);
  }
}

// ===== Main Analyze Function =====
async function analyzeCareer() {
  const resumeText = document.getElementById('resumeText').value.trim();
  const targetRole = document.getElementById('targetRole').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();

  if (!resumeText) return showError('Please paste your resume text.');
  if (!targetRole) return showError('Please enter your target role.');
  if (!apiKey) return showError('Please enter your Gemini API key.');

  showLoading();

  const prompt = buildPrompt(resumeText, targetRole);

  try {
    const result = await callGemini(apiKey, prompt);
    lastResult = result;
    renderResults(result);
    showResults();
  } catch (err) {
    showError(`Error: ${err.message || 'Something went wrong. Please check your API key and try again.'}`);
  }
}

function buildPrompt(resumeText, targetRole) {
  return `You are an AI Career Copilot designed to help students become job-ready.

Your task is to analyze the user's resume and target job role, then generate a structured, practical, and actionable career plan.

INPUT:
1. Resume Text: ${resumeText}
2. Target Role: ${targetRole}

OUTPUT FORMAT (STRICT JSON):

{
  "role": "",
  "current_skills": [],
  "missing_skills": [],
  "skill_gap_analysis": {
    "strong_areas": [],
    "weak_areas": []
  },
  "readiness_score": 0,
  "category": "",
  "reasoning": "",
  "roadmap": [
    {
      "phase": "",
      "duration": "",
      "tasks": []
    }
  ],
  "projects_to_build": [],
  "job_readiness_timeline": "",
  "suggested_job_titles": []
}

RULES:
1. Extract all relevant technical and soft skills from the resume.
2. Compare them with the target role requirements.
3. Identify missing or weak skills clearly.
4. Assign a READINESS SCORE (0–100):
   - 70–100 → "READY"
   - 50–69 → "NEAR_READY"
   - Below 50 → "NOT_READY"
5. Give a short reasoning for the score.
6. Generate a STEP-BY-STEP ROADMAP:
   - Divide into phases (e.g., Basics, Projects, Interview Prep)
   - Each phase must have clear, actionable tasks
7. Be PRACTICAL:
   - Avoid vague suggestions like "learn programming"
   - Use specific tasks like "build REST API using Node.js"
8. Suggest 2–3 PROJECTS the user should build.
9. Give a realistic timeline (in days or weeks).
10. Suggest relevant job titles the user can apply for.

IMPORTANT:
- Be concise but useful
- Do not use generic advice
- Focus on execution, not theory
- Output ONLY valid JSON (no extra text, no markdown code fences)`;
}

async function callGemini(apiKey, prompt) {
  const model = document.getElementById('modelSelect')?.value || 'gemini-2.5-flash-preview-04-17';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 4096,
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const msg = errData?.error?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip markdown code fences if any
  const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('Could not parse AI response. Please try again.');
    }
  }
  return parsed;
}

// ===== Render Results =====
function renderResults(data) {
  // Summary bar
  document.getElementById('summaryRole').textContent = `🎯 Target: ${data.role || 'N/A'}`;
  document.getElementById('summaryTimeline').textContent = `⏱ ${data.job_readiness_timeline || 'Timeline not specified'}`;

  // Score
  const score = Number(data.readiness_score) || 0;
  animateScore(score);
  const cat = data.category || deriveCategory(score);
  const badge = document.getElementById('scoreBadge');
  badge.textContent = cat.replace(/_/g, ' ');
  const badgeClasses = {
    READY: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    NEAR_READY: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
    NOT_READY: 'bg-error/12 text-error border border-error/25'
  };
  badge.className = `inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${badgeClasses[cat] || badgeClasses.NOT_READY}`;
  document.getElementById('scoreReasoning').textContent = data.reasoning || '';

  // Skills
  renderTags('strongAreas', data.skill_gap_analysis?.strong_areas || [], 'tag-strong');
  renderTags('weakAreas', data.missing_skills || data.skill_gap_analysis?.weak_areas || [], 'tag-weak');

  // Roadmap
  renderRoadmap(data.roadmap || []);

  // Projects
  renderProjects(data.projects_to_build || []);

  // Job titles
  renderJobs(data.suggested_job_titles || []);
}

function deriveCategory(score) {
  if (score >= 70) return 'READY';
  if (score >= 50) return 'NEAR_READY';
  return 'NOT_READY';
}

function animateScore(target) {
  const numEl = document.getElementById('scoreNumber');
  const ringFill = document.getElementById('ringFill');
  const circumference = 314;

  let current = 0;
  const step = target / 60;

  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    numEl.textContent = Math.round(current);
    const offset = circumference - (circumference * current) / 100;
    ringFill.style.strokeDashoffset = offset;
    if (current >= target) clearInterval(timer);
  }, 25);
}

function renderTags(containerId, items, cls) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  if (!items || items.length === 0) {
    el.innerHTML = `<span class="tag ${cls}" style="opacity:0.5">None identified</span>`;
    return;
  }
  items.forEach(item => {
    const span = document.createElement('span');
    span.className = `tag ${cls}`;
    span.textContent = item;
    el.appendChild(span);
  });
}

function renderRoadmap(phases) {
  const el = document.getElementById('roadmapPhases');
  el.innerHTML = '';
  if (!phases.length) {
    el.innerHTML = '<p class="text-xs text-outline">No roadmap generated.</p>';
    return;
  }
  phases.forEach((phase, i) => {
    const isLast = i === phases.length - 1;
    const div = document.createElement('div');
    div.className = 'flex gap-6 ' + (isLast ? 'pb-0' : 'pb-6');
    const tasks = (phase.tasks || []).map(t =>
      `<div class="flex items-start gap-2.5 text-xs text-on-surface-variant leading-relaxed">
        <div class="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shadow-[0_0_6px_rgba(192,193,255,0.5)]"></div>
        <span>${escHtml(t)}</span>
      </div>`
    ).join('');
    div.innerHTML = `
      <div class="flex flex-col items-center gap-2 flex-shrink-0">
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary-container to-secondary-container flex items-center justify-center text-white text-xs font-black shadow-lg shadow-indigo-500/20">${i + 1}</div>
        ${isLast ? '' : '<div class="flex-1 w-px bg-gradient-to-b from-primary-container/40 to-transparent min-h-[40px]"></div>'}
      </div>
      <div class="flex-1 pt-1">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-sm font-black text-on-surface">${escHtml(phase.phase || `Phase ${i + 1}`)}</span>
          <span class="px-2.5 py-0.5 rounded-full bg-tertiary/10 border border-tertiary/20 text-tertiary text-[10px] font-black uppercase tracking-widest">${escHtml(phase.duration || '')}</span>
        </div>
        <div class="space-y-2">${tasks}</div>
      </div>`;
    el.appendChild(div);
  });
}

function renderProjects(projects) {
  const el = document.getElementById('projectList');
  el.innerHTML = '';
  if (!projects.length) {
    el.innerHTML = '<p class="text-xs text-outline">No projects suggested.</p>';
    return;
  }
  projects.forEach((p, i) => {
    const text = typeof p === 'string' ? p : (p.name || JSON.stringify(p));
    const div = document.createElement('div');
    div.className = 'flex items-start gap-3.5 p-4 rounded-xl bg-surface-container-highest/40 border border-white/5 hover:border-white/10 transition-colors';
    div.innerHTML = `
      <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-secondary-container to-tertiary-container flex items-center justify-center text-white text-xs font-black">${i + 1}</div>
      <p class="text-xs text-on-surface-variant leading-relaxed pt-1.5">${escHtml(text)}</p>`;
    el.appendChild(div);
  });
}

function renderJobs(jobs) {
  const el = document.getElementById('jobsList');
  el.innerHTML = '';
  if (!jobs.length) {
    el.innerHTML = '<p class="text-xs text-outline">No job titles suggested.</p>';
    return;
  }
  jobs.forEach(job => {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 p-3.5 rounded-xl bg-surface-container-highest/40 border border-white/5 hover:border-primary/20 hover:bg-primary/5 transition-all text-sm font-medium text-on-surface-variant';
    div.innerHTML = `
      <span class="material-symbols-outlined text-primary text-[16px]">work</span>
      <span class="flex-1">${escHtml(job)}</span>
      <span class="material-symbols-outlined text-outline text-[14px]">arrow_forward</span>`;
    el.appendChild(div);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== Download JSON =====
function downloadJSON() {
  if (!lastResult) return;
  const blob = new Blob([JSON.stringify(lastResult, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `career-plan-${Date.now()}.json`;
  a.click();
}
