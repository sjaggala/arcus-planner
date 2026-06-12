// Arcus Planner — Shared Data Layer (data.js)
// Loaded by all pages. Provides the Arc namespace + global modal/nav utilities.
// -----------------------------------------------------------------

'use strict';

// =====================================================================
// FIREBASE CONFIGURATION
// =====================================================================
// HOW TO SET UP (one-time, done by you — users just click "Sign in with Google"):
//
//  1. Go to https://console.firebase.google.com → Create project → name it "arcus-planner"
//  2. Project Settings → General → Add app → Web → register as "Arcus" → copy config below
//  3. Authentication → Get Started → Sign-in method → Google → Enable → Save
//  4. Firestore Database → Create database → Start in production mode → choose region
//  5. Firestore → Rules tab → replace with (includes item-level collaboration):
//       rules_version = '2';
//       service cloud.firestore {
//         match /databases/{database}/documents {
//           match /users/{uid}/store/{doc} {
//             allow read, write: if request.auth != null && request.auth.uid == uid;
//           }
//           match /shared_items/{itemId} {
//             allow create: if request.auth != null &&
//               request.resource.data.ownerUid == request.auth.uid;
//             allow read, update: if request.auth != null && (
//               resource.data.ownerUid == request.auth.uid ||
//               request.auth.token.email.lower() in resource.data.members
//             );
//             allow delete: if request.auth != null &&
//               resource.data.ownerUid == request.auth.uid;
//           }
//           match /connections/{pairId} {
//             allow create: if request.auth != null &&
//               request.resource.data.fromEmail == request.auth.token.email.lower();
//             allow read, update, delete: if request.auth != null && (
//               resource.data.fromEmail == request.auth.token.email.lower() ||
//               resource.data.toEmail == request.auth.token.email.lower()
//             );
//           }
//         }
//       }
//  6. Authentication → Settings → Authorized domains → add your GitHub Pages domain
//     (e.g. sjaggala.github.io)
//  7. Replace the placeholder values below with your actual config values
//
const ARC_FIREBASE_CONFIG = {
  apiKey:            'AIzaSyDtrNJVfIlt1-_kWT8_PDfPVozmsX5nHs8',
  authDomain:        'arcus-planner.firebaseapp.com',
  projectId:         'arcus-planner',
  storageBucket:     'arcus-planner.firebasestorage.app',
  messagingSenderId: '314398883893',
  appId:             '1:314398883893:web:72566b81e60f01be2eb17c',
};

// Internal Firebase state (set by arcFirebaseInit)
window._arcUser   = null;  // signed-in Firebase user
window._arcDb     = null;  // Firestore instance

// =====================================================================
// GLOBAL MODAL SYSTEM
// (Must be global so onclick="closeModal()" works from inline HTML)
// =====================================================================
function showModal(html) {
  const ov = document.getElementById('modal-overlay');
  const wr = document.getElementById('modal-wrap');
  if (!ov || !wr) return;
  ov.classList.add('show');
  wr.innerHTML = html;
  document.addEventListener('keydown', _arcEsc);
  setTimeout(() => {
    const f = wr.querySelector('input:not([type=hidden]),textarea');
    if (f) f.focus();
  }, 80);
}

function closeModal() {
  const ov = document.getElementById('modal-overlay');
  const wr = document.getElementById('modal-wrap');
  if (ov) ov.classList.remove('show');
  if (wr) wr.innerHTML = '';
  document.removeEventListener('keydown', _arcEsc);
}

function _arcEsc(e) { if (e.key === 'Escape') closeModal(); }
function overlayClick(e) { if (e.target.id === 'modal-overlay') closeModal(); }

function setUrlParam(key, val) {
  const p = new URLSearchParams(location.search);
  if (val) p.set(key, val); else p.delete(key);
  const qs = p.toString();
  history.replaceState({}, '', location.pathname + (qs ? '?' + qs : ''));
}

// =====================================================================
// ARC NAMESPACE
// =====================================================================
const Arc = (() => {
  // ── Core Utilities ──────────────────────────────────────────────────
  const uid     = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc     = s  => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const dateStr = d  => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today   = () => dateStr(new Date());

  // ── Outline icon set (Feather-style, stroke = currentColor) ─────────
  // Single consistent line-icon style used across the whole app instead
  // of emoji / system glyphs.
  const ICON_PATHS = {
    share:    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    pin:      '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    x:        '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    trash:    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    plus:     '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    gear:     '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    user:     '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users:    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    edit:     '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    list:     '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    tag:      '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    'log-out':'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    filter:   '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    folder:   '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    moon:     '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun:      '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    cloud:    '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    columns:  '<path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/>',
    grid:     '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    'chevron-down':  '<polyline points="6 9 12 15 18 9"/>',
    'chevron-left':  '<polyline points="15 18 9 12 15 6"/>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
    'arrow-right':   '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    'rotate-ccw':    '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    expand:   '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>',
    sliders:  '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    book:     '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    chart:    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    'pin-fill': '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    droplet:  '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    link:     '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    code:     '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    search:   '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  };
  const FILLED_ICONS = new Set(['pin-fill']);
  const icon = (name, size = 16, sw = 2) => {
    const p = ICON_PATHS[name];
    if (!p) return '';
    const fill = FILLED_ICONS.has(name) ? 'currentColor' : 'none';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;vertical-align:-2px">${p}</svg>`;
  };

  const DB = {
    _localSaveTimer: null,
    get(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) {
      localStorage.setItem(k, JSON.stringify(v));
      // Background sync to Firestore (fire-and-forget — localStorage is the fast cache)
      if (window._arcDb && window._arcUser) {
        let fv = v;
        // Strip base64 avatar before Firestore — it can exceed the 1 MB document limit
        // and silently kill the write. The avatar lives only in localStorage.
        if (k === 'arc_profile' && fv && typeof fv === 'object' && fv.avatar && fv.avatar.startsWith('data:')) {
          fv = { ...fv, avatar: null };
        }
        window._arcDb
          .collection('users').doc(window._arcUser.uid)
          .collection('store').doc(k)
          .set({ value: fv, ts: Date.now() })
          .catch(e => console.warn('Arcus: sync failed for', k, e));
      }
      // Auto-backup for local mode: if a folder is configured, save after 2 s of inactivity.
      // FolderSave is declared later in this closure but only referenced at call time — safe.
      if (localStorage.getItem('arc_local_mode') === '1') {
        clearTimeout(DB._localSaveTimer);
        DB._localSaveTimer = setTimeout(() => {
          FolderSave.folderName().then(fname => {
            if (fname) FolderSave.saveNow().catch(() => {});
          });
        }, 2000);
      }
    },
  };

  // ── Constants ────────────────────────────────────────────────────────
  const STATUSES = [
    { val: 'not_started', label: 'Not Started', color: '#6a74a0' },
    { val: 'in_progress', label: 'In Progress', color: '#7b79f7' },
    { val: 'completed',   label: 'Completed',   color: '#3ec97a' },
    { val: 'on_hold',     label: 'On Hold',      color: '#f5c542' },
    { val: 'cancelled',   label: 'Cancelled',    color: '#f06f6f' },
  ];

  const COLORS = ['#7b79f7','#60a5fa','#f06f6f','#f5c542','#3ec97a','#34d399','#f472b6','#a78bfa','#fb923c','#2dd4bf','#e879f9','#94a3b8'];
  const PROJ_COLORS = ['#7b79f7','#60a5fa','#3ec97a','#f5c542','#f06f6f','#f472b6','#a78bfa','#fb923c','#2dd4bf','#e879f9'];
  const EMOJIS = ['📁','🚀','⭐','💡','🎯','🔥','📊','🌱','💎','🏆','🛠️','🎨','📝','⚡','🌟','🔬','🎵','🏗️','🌍','💼'];
  const PRIORITIES = [
    { val: 'low',    label: 'Low',    color: '#6a74a0' },
    { val: 'medium', label: 'Medium', color: '#f5c542' },
    { val: 'high',   label: 'High',   color: '#f06f6f' },
  ];

  // ── Settings ─────────────────────────────────────────────────────────
  const Settings = {
    _d: null,
    load()      { try { this._d = JSON.parse(localStorage.getItem('arc_cfg')) || {}; } catch { this._d = {}; } return this; },
    // Route through DB.set so settings sync to Firestore — otherwise the
    // cloud copy of arc_cfg overwrites local changes on the next page load
    save()      { DB.set('arc_cfg', this._d || {}); },
    get(k, def) { if (!this._d) this.load(); return this._d[k] ?? def; },
    set(k, v)   { if (!this._d) this.load(); this._d[k] = v; this.save(); },
  };

  // ── Profile ──────────────────────────────────────────────────────────
  const Profile = {
    DEFAULTS: { firstName: '', lastName: '', email: '', role: '', bio: '', avatar: null },
    get()          { return { ...this.DEFAULTS, ...(DB.get('arc_profile') || {}) }; },
    save(p)        { DB.set('arc_profile', p); },
    displayName()  { const p = this.get(); return p.firstName || 'there'; },
    fullName()     { const p = this.get(); return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Your Name'; },
    initials()     { const p = this.get(); return ((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase() || '?'; },
    greeting()     { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; },
  };

  // ── Projects (read helpers — write ops in planner.html) ──────────────
  const Projects = {
    getAll()   { return DB.get('arc_p') || []; },
    getById(id){ return this.getAll().find(p => p.id === id) || null; },
    save(ps)   { DB.set('arc_p', ps); },
  };

  // ── Goals (read helpers) ─────────────────────────────────────────────
  const Goals = {
    getAll()        { return DB.get('arc_g') || []; },
    save(gs)        { DB.set('arc_g', gs); },
    getByProject(pid){ return this.getAll().filter(g => g.projectId === pid); },
    activeToday()   { const t = today(); return this.getAll().filter(g => g.dateFrom <= t && g.dateTo >= t); },
    overdue()       { return this.getAll().filter(g => this.isOverdue(g)); },
    isOverdue(g)    { return !['completed','cancelled'].includes(g.status) && g.dateTo < today(); },
    statusInfo(val) { return STATUSES.find(s => s.val === val) || STATUSES[0]; },
  };

  // ── Default Buckets ──────────────────────────────────────────────────
  const DEFAULT_BUCKETS = [
    { id: 'b_backlog', name: 'Backlog',     color: '#6a74a0', statuses: [],                        isDefault: true, order: 0 },
    { id: 'b_todo',    name: 'To Do',       color: '#7b79f7', statuses: ['not_started'],           isDefault: true, order: 1 },
    { id: 'b_prog',    name: 'In Progress', color: '#7b79f7', statuses: ['in_progress'],           isDefault: true, order: 2 },
    { id: 'b_review',  name: 'In Review',   color: '#f5c542', statuses: [],                        isDefault: true, order: 3 },
    { id: 'b_hold',    name: 'On Hold',     color: '#fb923c', statuses: ['on_hold'],               isDefault: true, order: 4 },
    { id: 'b_done',    name: 'Done',        color: '#3ec97a', statuses: ['completed','cancelled'], isDefault: true, order: 5 },
  ];

  // ── Buckets ──────────────────────────────────────────────────────────
  const Buckets = {
    getAll() {
      const s = DB.get('arc_buckets');
      if (!s || !s.length) { this.reset(); return DB.get('arc_buckets'); }
      let bs = [...s];
      // Migration: add Backlog column for existing users who don't have it yet
      if (!bs.find(b => b.id === 'b_backlog')) {
        bs.unshift({ id: 'b_backlog', name: 'Backlog', color: '#6a74a0', statuses: [], isDefault: true, order: -1 });
        this.save(bs);
      }
      return bs.sort((a, b) => a.order - b.order);
    },
    save(bs)  { DB.set('arc_buckets', bs); },
    add(b)    { const bs = this.getAll(); b.order = Math.max(0, ...bs.map(x => x.order)) + 1; bs.push(b); this.save(bs); },
    update(b) { this.save(this.getAll().map(x => x.id === b.id ? b : x)); },
    delete(id, fallbackId) {
      // Move tasks in deleted bucket to fallback (To Do)
      const fb = fallbackId || 'b_todo';
      const ts = DB.get('arc_tasks') || [];
      const moved = [];
      DB.set('arc_tasks', ts.map(t => {
        if (t.bucketId !== id) return t;
        const nt = { ...t, bucketId: fb }; moved.push(nt); return nt;
      }));
      moved.forEach(t => Shared.pushUpdate(t));
      this.save(this.getAll().filter(b => b.id !== id));
    },
    reset()   { this.save(DEFAULT_BUCKETS.map(b => ({ ...b }))); },
    forGoal(goal) { return this.getAll().find(b => b.statuses && b.statuses.includes(goal.status)); },
  };

  // ── Events / Reminders ──────────────────────────────────────────────
  const Events = {
    getAll()   { return DB.get('arc_ev') || []; },
    save(evs)  { DB.set('arc_ev', evs); },
    add(ev)    { const evs = this.getAll(); evs.push(ev); this.save(evs); Activity.log('created', 'event', ev.title, ev.id); },
    update(ev) { this.save(this.getAll().map(x => x.id === ev.id ? ev : x)); Activity.log('updated', 'event', ev.title, ev.id); },
    delete(id) { const ev = this.getAll().find(x => x.id === id); this.save(this.getAll().filter(x => x.id !== id)); if (ev) Activity.log('deleted', 'event', ev.title, id); },
    upcoming(days = 14) {
      const t = today();
      const lim = dateStr(new Date(Date.now() + days * 86400000));
      return this.getAll()
        .filter(ev => ev.startDate >= t && ev.startDate <= lim)
        .sort((a, b) => (a.startDate + (a.startTime||'')).localeCompare(b.startDate + (b.startTime||'')));
    },
    onDate(ds) { return this.getAll().filter(ev => ev.startDate === ds || (ev.endDate && ev.startDate <= ds && ev.endDate >= ds)); },
  };

  // ── Activity Log ─────────────────────────────────────────────────────
  const Activity = {
    MAX: 100,
    getAll()  { return DB.get('arc_activity') || []; },
    log(action, type, title, entityId) {
      const entries = this.getAll();
      entries.unshift({ id: uid(), action, type, title: title || 'Untitled', entityId: entityId || '', timestamp: new Date().toISOString() });
      if (entries.length > this.MAX) entries.length = this.MAX;
      DB.set('arc_activity', entries);
    },
    clear()   { DB.set('arc_activity', []); },
  };

  // ── Tasks (standalone, non-goal tasks) ──────────────────────────────
  const Tasks = {
    getAll()     { return DB.get('arc_tasks') || []; },
    save(ts)     { DB.set('arc_tasks', ts); },
    add(t)       { const ts = this.getAll(); ts.push(t); this.save(ts); Activity.log('created', 'task', t.title, t.id); },
    update(t)    { this.save(this.getAll().map(x => x.id === t.id ? t : x)); Activity.log('updated', 'task', t.title, t.id); Shared.pushUpdate(t); },
    delete(id)   { const t = this.getAll().find(x => x.id === id); this.save(this.getAll().filter(x => x.id !== id)); if (t) Activity.log('deleted', 'task', t.title, id); Shared.unshareAll(id); },
    pending()      { return this.getAll().filter(t => t.bucketId !== 'b_done'); },
    dueToday()     { const t = today(); return this.getAll().filter(x => x.dueDate === t && x.bucketId !== 'b_done'); },
    overdue()      { const t = today(); return this.getAll().filter(x => x.dueDate && x.dueDate < t && x.bucketId !== 'b_done'); },
    dueThisWeek()  {
      const t = today(); const d = new Date();
      const daysUntilSunday = d.getDay() === 0 ? 0 : 7 - d.getDay();
      const end = new Date(d); end.setDate(d.getDate() + daysUntilSunday);
      const endStr = dateStr(end);
      return this.getAll().filter(x => x.dueDate && x.dueDate > t && x.dueDate <= endStr && x.bucketId !== 'b_done');
    },
    dueNextWeek()  {
      const d = new Date();
      const daysUntilSunday = d.getDay() === 0 ? 0 : 7 - d.getDay();
      const startNW = new Date(d); startNW.setDate(d.getDate() + daysUntilSunday + 1);
      const endNW   = new Date(startNW); endNW.setDate(startNW.getDate() + 6);
      const startStr = dateStr(startNW); const endStr = dateStr(endNW);
      return this.getAll().filter(x => x.dueDate && x.dueDate >= startStr && x.dueDate <= endStr && x.bucketId !== 'b_done');
    },
  };

  // ── Comments (updates on tasks & goals) ──────────────────────────────
  const Comments = {
    _k: 'arc_comments',
    getAll()          { return DB.get(this._k) || {}; },
    forEntity(id)     { return (this.getAll()[id] || []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); },
    add(entityId, text, html) {
      if (!text || !text.trim()) return null;
      const all = this.getAll();
      if (!all[entityId]) all[entityId] = [];
      // Record the author so collaborators in shared workspaces can tell who posted
      const by = (window._arcUser?.displayName || Profile.displayName() || '').split(' ')[0] || null;
      const c = { id: uid(), text: text.trim(), html: html || null, by: by === 'there' ? null : by, createdAt: new Date().toISOString() };
      all[entityId].push(c);
      DB.set(this._k, all);
      return c;
    },
    delete(entityId, commentId) {
      const all = this.getAll();
      if (all[entityId]) { all[entityId] = all[entityId].filter(c => c.id !== commentId); DB.set(this._k, all); }
    },
  };

  // ── Labels ───────────────────────────────────────────────────────────
  const Labels = {
    PRESET_COLORS: ['#7b79f7','#60a5fa','#3ec97a','#f5c542','#f06f6f','#f472b6','#fb923c','#2dd4bf','#a78bfa','#94a3b8'],
    getAll()    { return DB.get('arc_labels') || []; },
    save(ls)    { DB.set('arc_labels', ls); },
    add(l)      { const ls = this.getAll(); ls.push(l); this.save(ls); },
    update(l)   { this.save(this.getAll().map(x => x.id === l.id ? l : x)); },
    delete(id)  { this.save(this.getAll().filter(l => l.id !== id)); },
    getById(id) { return this.getAll().find(l => l.id === id) || null; },
  };

  // ── Pinned Tasks (Focus board) ────────────────────────────────────────
  const PinnedTasks = {
    getAll()   { return DB.get('arc_pinned') || []; },
    save(ps)   { DB.set('arc_pinned', ps); },
    pin(taskId, opts) {
      const all = this.getAll();
      if (all.find(p => p.taskId === taskId)) return;
      // Stagger placement so notes don't overlap
      const idx  = all.length;
      const cols  = 4;
      const col   = idx % cols;
      const row   = Math.floor(idx / cols);
      all.push({
        taskId,
        x: 24 + col * 240,
        y: 24 + row * 220,
        noteColor:  opts?.noteColor  || '#fef08a',
        fontFamily: opts?.fontFamily || 'Outfit',
        fontSize:   opts?.fontSize   || 14,
        bold:       false,
        italic:     false,
        textColor:  opts?.textColor  || '#1a1a2e',
      });
      this.save(all);
    },
    unpin(taskId) { this.save(this.getAll().filter(p => p.taskId !== taskId)); },
    isPinned(taskId) { return !!this.getAll().find(p => p.taskId === taskId); },
    update(pin)  { this.save(this.getAll().map(x => x.taskId === pin.taskId ? pin : x)); },
    updatePos(taskId, x, y) {
      const all = this.getAll();
      const p = all.find(x => x.taskId === taskId);
      if (p) { p.x = x; p.y = y; this.save(all); }
    },
  };

  // ── Checklists ───────────────────────────────────────────────────────
  const Checklists = {
    getAll()    { return DB.get('arc_checklists') || []; },
    save(cls)   { DB.set('arc_checklists', cls); },
    add(cl)     { const all = this.getAll(); all.push(cl); this.save(all); },
    update(cl)  { this.save(this.getAll().map(x => x.id === cl.id ? cl : x)); Shared.pushUpdate(cl); },
    delete(id)  { this.save(this.getAll().filter(x => x.id !== id)); Shared.unshareAll(id); },
    getById(id) { return this.getAll().find(x => x.id === id) || null; },
  };

  // ── Shared Items (item-level collaboration) ──────────────────────────
  // Each shared item (task, goal, project…) lives as its OWN document in the
  // top-level `shared_items` Firestore collection, keyed by the item's id:
  //   { type, data, comments, ownerUid, ownerName, ownerEmail, ownerPhoto,
  //     members: [email…], createdAt, ts }
  // While an item is shared, that doc is the source of truth. The owner keeps
  // a local copy in their normal store: every local edit is pushed to the doc,
  // and member edits are merged back into the owner's store on page load.
  // Members see the item injected into their own board, badged with the
  // owner's avatar — they never get access to anything else of the owner's.
  const Shared = {
    _mine: [], _withMe: [],
    available() { return !!(window._arcDb && window._arcUser); },
    _col() { return window._arcDb.collection('shared_items'); },
    // Hydrate from the local snapshot so shared cards (and their avatars)
    // render with the very first paint instead of after the network round-trip
    _hydrate() {
      try {
        const c = JSON.parse(localStorage.getItem('arc_shared_cache'));
        if (c) { this._mine = c.mine || []; this._withMe = c.withMe || []; }
      } catch {}
    },
    _persist() {
      try { localStorage.setItem('arc_shared_cache', JSON.stringify({ mine: this._mine, withMe: this._withMe })); } catch {}
    },
    async load() {
      if (!this.available()) { this._mine = []; this._withMe = []; return; }
      const u = window._arcUser;
      try {
        const [mine, withMe] = await Promise.all([
          this._col().where('ownerUid', '==', u.uid).get(),
          u.email
            ? this._col().where('members', 'array-contains', u.email.toLowerCase()).get()
            : Promise.resolve({ docs: [] }),
        ]);
        this._mine   = mine.docs.map(d => ({ id: d.id, ...d.data() }));
        this._withMe = withMe.docs.map(d => ({ id: d.id, ...d.data() }));
        this._persist();
      } catch (e) { console.warn('Arcus: could not load shared items', e); }
    },
    isSharedByMe(id) { return this._mine.some(s => s.id === id); },
    isWithMe(id)     { return this._withMe.some(s => s.id === id); },
    get(id)          { return this._mine.find(s => s.id === id) || this._withMe.find(s => s.id === id) || null; },
    membersOf(id)    { return this.get(id)?.members || []; },
    withMeOfType(type) { return this._withMe.filter(s => s.type === type); },
    // Owner: merge member edits into the local store (the shared doc wins)
    applyMineToLocal() {
      const sharedTasks = this._mine.filter(s => s.type === 'task');
      if (sharedTasks.length) {
        const tasks = Tasks.getAll(); let changed = false;
        sharedTasks.forEach(s => {
          const i = tasks.findIndex(t => t.id === s.id);
          if (i >= 0 && JSON.stringify(tasks[i]) !== JSON.stringify(s.data)) {
            tasks[i] = { ...s.data }; changed = true;
          }
        });
        if (changed) Tasks.save(tasks);
      }
      const sharedLists = this._mine.filter(s => s.type === 'list');
      if (sharedLists.length) {
        const cls = Checklists.getAll(); let changed = false;
        sharedLists.forEach(s => {
          const i = cls.findIndex(c => c.id === s.id);
          if (i >= 0 && JSON.stringify(cls[i]) !== JSON.stringify(s.data)) {
            cls[i] = { ...s.data }; changed = true;
          }
        });
        if (changed) Checklists.save(cls);
      }
    },
    async share(type, item, email) {
      const e = String(email).toLowerCase().trim();
      if (!e || !e.includes('@')) throw new Error('Enter a valid email address.');
      const u = window._arcUser;
      if (e === (u.email || '').toLowerCase()) throw new Error('That is your own email.');
      const existing = this._mine.find(s => s.id === item.id);
      if (existing) {
        if (existing.members.includes(e)) return;
        await this._col().doc(item.id).update({
          members: firebase.firestore.FieldValue.arrayUnion(e), ts: Date.now(),
        });
        existing.members.push(e);
        this._persist();
      } else {
        const doc = {
          type, data: { ...item },
          comments:   Comments.forEntity(item.id),  // carry over existing updates
          ownerUid:   u.uid,
          ownerName:  u.displayName || u.email || 'Arcus user',
          ownerEmail: (u.email || '').toLowerCase(),
          ownerPhoto: u.photoURL || null,
          members:    [e],
          createdAt:  Date.now(), ts: Date.now(),
        };
        await this._col().doc(item.id).set(doc);
        this._mine.push({ id: item.id, ...doc });
        this._persist();
      }
    },
    async unshare(id, email) {
      const s = this._mine.find(x => x.id === id); if (!s) return;
      const left = s.members.filter(m => m !== email);
      if (left.length) {
        await this._col().doc(id).update({ members: left, ts: Date.now() });
        s.members = left;
      } else {
        await this._col().doc(id).delete();
        this._mine = this._mine.filter(x => x.id !== id);
      }
      this._persist();
    },
    async unshareAll(id) {
      if (!this.isSharedByMe(id)) return;
      try { await this._col().doc(id).delete(); }
      catch (e) { console.warn('Arcus: unshare failed', e); }
      this._mine = this._mine.filter(x => x.id !== id);
      this._persist();
    },
    // Owner: push a local edit to the shared doc (fire-and-forget)
    pushUpdate(item) {
      const s = this._mine.find(x => x.id === item.id); if (!s) return;
      s.data = { ...item };
      this._col().doc(item.id).update({ data: s.data, ts: Date.now() })
        .catch(e => console.warn('Arcus: shared item push failed', e));
    },
    // Member: save an edit to an item shared with them
    async updateAsMember(id, item) {
      const s = this._withMe.find(x => x.id === id); if (!s) return;
      s.data = { ...item };
      await this._col().doc(id).update({ data: s.data, ts: Date.now() });
    },
    // Member: remove themself from a shared item
    async leave(id) {
      const e = (window._arcUser?.email || '').toLowerCase();
      await this._col().doc(id).update({
        members: firebase.firestore.FieldValue.arrayRemove(e), ts: Date.now(),
      });
      this._withMe = this._withMe.filter(x => x.id !== id);
      this._persist();
    },
    // Comments on shared items live inside the shared doc (visible to everyone)
    commentsOf(id) { return this.get(id)?.comments || []; },
    async addComment(id, c) {
      const s = this.get(id); if (!s) return;
      s.comments = [...(s.comments || []), c];
      await this._col().doc(id).update({ comments: s.comments, ts: Date.now() });
    },
    async deleteComment(id, commentId) {
      const s = this.get(id); if (!s) return;
      s.comments = (s.comments || []).filter(c => c.id !== commentId);
      await this._col().doc(id).update({ comments: s.comments, ts: Date.now() });
    },
  };

  // ── People (directory / address book) ────────────────────────────────
  // Connections live in the top-level `connections` collection, one doc per
  // pair of people (doc id = both emails, sorted, joined with '__'):
  //   { fromUid, fromEmail, fromName, fromPhoto, toEmail, toName,
  //     toUid, toRealName, toPhoto, status: 'pending'|'accepted', createdAt, ts }
  // The sender supplies toName (what they call the person); when the invite is
  // accepted the recipient's real display name and photo are stored too.
  const People = {
    _list: [],   // normalized: { id, email, name, photo, status, direction }
    available() { return !!(window._arcDb && window._arcUser); },
    _col() { return window._arcDb.collection('connections'); },
    pairId(a, b) { return [String(a).toLowerCase().trim(), String(b).toLowerCase().trim()].sort().join('__'); },
    myEmail() { return (window._arcUser?.email || '').toLowerCase(); },
    // Hydrate from the local snapshot so people (avatars, filter circles)
    // render with the first paint instead of after the network round-trip
    _hydrate() {
      try {
        const c = JSON.parse(localStorage.getItem('arc_people_cache'));
        if (Array.isArray(c)) this._list = c;
      } catch {}
    },
    _persist() {
      try { localStorage.setItem('arc_people_cache', JSON.stringify(this._list)); } catch {}
    },
    async load() {
      if (!this.available() || !this.myEmail()) { this._list = []; return; }
      try {
        const me = this.myEmail();
        const [out, inc] = await Promise.all([
          this._col().where('fromEmail', '==', me).get(),
          this._col().where('toEmail', '==', me).get(),
        ]);
        const norm = (d, dir) => {
          const x = d.data();
          const other = dir === 'out'
            ? { email: x.toEmail, name: x.toRealName || x.toName || x.toEmail, photo: x.toPhoto || null }
            : { email: x.fromEmail, name: x.fromName || x.fromEmail, photo: x.fromPhoto || null };
          return { id: d.id, direction: dir, status: x.status, ...other };
        };
        this._list = [
          ...out.docs.map(d => norm(d, 'out')),
          ...inc.docs.map(d => norm(d, 'in')),
        ];
        this._persist();
      } catch (e) { console.warn('Arcus: could not load people', e); }
    },
    connected()    { return this._list.filter(p => p.status === 'accepted'); },
    pendingIn()    { return this._list.filter(p => p.status === 'pending' && p.direction === 'in'); },
    pendingOut()   { return this._list.filter(p => p.status === 'pending' && p.direction === 'out'); },
    byEmail(email) { const e = String(email || '').toLowerCase(); return this._list.find(p => p.email === e) || null; },
    nameFor(email) {
      const m = this.metaFor(email);
      if (m.name) return m.name;
      return this.byEmail(email)?.name || email;
    },
    // Personal address-book details (company, phone, notes…) — stored in MY
    // data only; the other person never sees what I write about them.
    metaAll()      { return DB.get('arc_people_meta') || {}; },
    metaFor(email) { return this.metaAll()[String(email || '').toLowerCase()] || {}; },
    saveMeta(email, m) {
      const all = this.metaAll();
      all[String(email).toLowerCase()] = m;
      DB.set('arc_people_meta', all);
    },
    deleteMeta(email) {
      const all = this.metaAll();
      delete all[String(email).toLowerCase()];
      DB.set('arc_people_meta', all);
    },
    async invite(email, name) {
      const e = String(email).toLowerCase().trim();
      if (!e || !e.includes('@')) throw new Error('Enter a valid email address.');
      const me = this.myEmail();
      if (e === me) throw new Error('That is your own email.');
      if (this.byEmail(e)) throw new Error('This person is already in your list.');
      const u = window._arcUser;
      const doc = {
        fromUid: u.uid, fromEmail: me,
        fromName: u.displayName || me, fromPhoto: u.photoURL || null,
        toEmail: e, toName: (name || '').trim() || e,
        toUid: null, toRealName: null, toPhoto: null,
        status: 'pending', createdAt: Date.now(), ts: Date.now(),
      };
      await this._col().doc(this.pairId(me, e)).set(doc);
      this._list.push({ id: this.pairId(me, e), direction: 'out', status: 'pending', email: e, name: doc.toName, photo: null });
      this._persist();
    },
    async accept(id) {
      const u = window._arcUser;
      await this._col().doc(id).update({
        status: 'accepted', toUid: u.uid,
        toRealName: u.displayName || this.myEmail(), toPhoto: u.photoURL || null,
        ts: Date.now(),
      });
      const p = this._list.find(x => x.id === id);
      if (p) p.status = 'accepted';
      this._persist();
    },
    async remove(id) {   // decline an invite, cancel an outgoing one, or disconnect
      await this._col().doc(id).delete();
      this._list = this._list.filter(x => x.id !== id);
      this._persist();
    },
  };

  // Instant-paint hydration from the last session's snapshots
  Shared._hydrate();
  People._hydrate();

  // ── Avatar HTML ──────────────────────────────────────────────────────
  function avatarHtml(size = 34) {
    const p = Profile.get(), ini = Profile.initials();
    // Prefer Google profile photo when signed in
    const photoURL = window._arcUser?.photoURL;
    const src = photoURL || p.avatar;
    if (src) {
      return `<img src="${src}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.15);display:block;flex-shrink:0" alt="avatar">`;
    }
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#7b79f7,#a78bfa);color:#fff;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * .38)}px;font-weight:700;border:2px solid rgba(255,255,255,.15);flex-shrink:0;letter-spacing:0">${ini}</div>`;
  }

  // ── Theme ────────────────────────────────────────────────────────────
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t || Settings.get('theme', 'dark'));
  }

  // ── Nav HTML ─────────────────────────────────────────────────────────
  function navHtml(activePage) {
    const links = [
      { id: 'home',     label: 'Home',     href: 'index.html' },
      { id: 'projects', label: 'Projects', href: 'projects.html' },
      { id: 'tasks',    label: 'Tasks',    href: 'tasks.html' },
      { id: 'events',   label: 'Events',   href: 'events.html' },
      { id: 'journal',  label: 'Journal',  href: 'journal.html' },
      { id: 'focus',    label: 'Focus',     href: 'focus.html' },
      { id: 'lists',    label: 'Lists',     href: 'lists.html' },
    ];
    const linksHtml = links.map(l =>
      `<a href="${l.href}" class="nav-link ${l.id === activePage ? 'active' : ''}">${l.label}</a>`
    ).join('');
    const ava = avatarHtml(32);
    const p = Profile.get();
    const isLocalMode = !window._arcUser && localStorage.getItem('arc_local_mode') === '1';
    const displayName = window._arcUser?.displayName || Profile.fullName() || Profile.displayName() || 'My Profile';
    const userEmail   = window._arcUser?.email || p.email || '';
    const userRole    = p.role || '';
    return `<nav class="shared-nav">
      <a href="index.html" class="nav-logo">Arc<span>us</span></a>
      <div class="nav-links">${linksHtml}</div>
      <div class="nav-right">
        ${isLocalMode ? `<span class="nav-local-badge" title="Data is on this device only — click to sign in" onclick="arcToggleProfileMenu(event)"><span class="nlb-dot"></span>Local only</span>` : ''}
        <div class="nav-profile-wrap">
          <button class="nav-avatar-btn" onclick="arcToggleProfileMenu(event)" title="${isLocalMode ? 'Local mode — click to sign in with Google' : 'Your Profile'}">${ava}</button>
          <div id="arc-pmenu" class="arc-pmenu">
            <div class="arc-pmenu-head">
              ${isLocalMode
                ? `<div class="arc-pmenu-name">Local Mode</div>
                   <div class="arc-pmenu-role">Not signed in — data is on this device only</div>`
                : `<div class="arc-pmenu-name">${esc(displayName)}</div>
                   ${userEmail ? `<div class="arc-pmenu-role">${esc(userEmail)}</div>` : ''}
                   ${userRole  ? `<div class="arc-pmenu-role" style="margin-top:2px">${esc(userRole)}</div>` : ''}`
              }
            </div>
            <div class="arc-pmenu-body">
              ${isLocalMode ? `
              <button class="arc-pmenu-item arc-pmenu-signin" onclick="arcCloseProfileMenu();arcSignInFromLocal()">
                <span class="apm-icon">${icon('cloud', 14)}</span> Sign in with Google
              </button>
              <div class="arc-pmenu-div"></div>
              ` : ''}
              <button class="arc-pmenu-item" onclick="arcCloseProfileMenu();Arc.openProfileModal()">
                <span class="apm-icon">${icon('edit', 13)}</span> Edit Profile
              </button>
              <button class="arc-pmenu-item" onclick="arcCloseProfileMenu();location.href='activity.html'">
                <span class="apm-icon">${icon('list', 14)}</span> Recent Activity
              </button>
              <div class="arc-pmenu-div"></div>
              <button class="arc-pmenu-item" onclick="arcCloseProfileMenu();Arc.openLabelManager()">
                <span class="apm-icon">${icon('tag', 13)}</span> Manage Labels
              </button>
              <button class="arc-pmenu-item" onclick="arcCloseProfileMenu();location.href='people.html'">
                <span class="apm-icon">${icon('users', 14)}</span> People &amp; Sharing
              </button>
              <div class="arc-pmenu-div"></div>
              <button class="arc-pmenu-item" onclick="arcCloseProfileMenu();openSettings()">
                <span class="apm-icon">${icon('gear', 14)}</span> Settings
              </button>
              ${!isLocalMode ? `
              <div class="arc-pmenu-div"></div>
              <button class="arc-pmenu-item" onclick="arcCloseProfileMenu();arcSignOut()" style="color:var(--red)">
                <span class="apm-icon">${icon('log-out', 13)}</span> Sign Out
              </button>` : ''}
            </div>
          </div>
        </div>
      </div>
    </nav>`;
  }

  // ── Data Export / Import ──────────────────────────────────────────────
  function exportAllData() {
    const data = {
      version: 3, exportedAt: new Date().toISOString(),
      profile:   Profile.get(),
      projects:  Projects.getAll(),
      goals:     Goals.getAll(),
      notes:     DB.get('arc_n')       || {},
      journals:  DB.get('arc_j')       || {},
      journals2: DB.get('arc_j2')      || [],
      buckets:   Buckets.getAll(),
      tasks:     Tasks.getAll(),
      events:    Events.getAll(),
      comments:  Comments.getAll(),
      labels:    Labels.getAll(),
      pinned:    PinnedTasks.getAll(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `arcus-backup-${dateStr(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importData() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const d = JSON.parse(await file.text());
        if (!d.projects && !d.goals) { alert('Invalid Arcus backup file.'); return; }
        if (!confirm(`Import from "${file.name}"? This replaces ALL current data.`)) return;
        if (d.profile)    Profile.save(d.profile);
        if (d.projects)   DB.set('arc_p',       d.projects);
        if (d.goals)      DB.set('arc_g',       d.goals);
        if (d.notes)      DB.set('arc_n',       d.notes);
        if (d.journals)   DB.set('arc_j',       d.journals);
        if (d.journals2)  DB.set('arc_j2',      d.journals2);
        if (d.buckets)    DB.set('arc_buckets', d.buckets);
        if (d.tasks)      DB.set('arc_tasks',   d.tasks);
        if (d.events)     DB.set('arc_ev',      d.events);
        if (d.comments)   DB.set('arc_comments', d.comments);
        if (d.labels)     DB.set('arc_labels',   d.labels);
        if (d.pinned)     DB.set('arc_pinned',   d.pinned);
        closeModal();
        if (typeof onDataImported === 'function') onDataImported();
        else window.location.reload();
      } catch { alert('Could not parse file. Please select a valid Arcus JSON backup.'); }
    };
    inp.click();
  }

  // ── Profile Modal ────────────────────────────────────────────────────
  function openProfileModal() {
    const p = Profile.get();
    const ava = p.avatar
      ? `<img src="${esc(p.avatar)}" style="width:68px;height:68px;border-radius:50%;object-fit:cover" alt="avatar">`
      : `<div style="width:68px;height:68px;border-radius:50%;background:linear-gradient(135deg,#7b79f7,#a78bfa);color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700">${Profile.initials()}</div>`;

    showModal(`<div class="modal">
      <div class="modal-hdr">
        <div><div class="modal-title">Your Profile</div><div class="modal-sub">Personalise your Arcus experience</div></div>
        <button class="close-btn" onclick="closeModal()">✕</button>
      </div>
      <div style="display:flex;align-items:center;gap:18px;padding:16px;background:var(--s3);border:1px solid var(--border);border-radius:10px;margin-bottom:20px">
        <div style="position:relative;cursor:pointer;flex-shrink:0" onclick="document.getElementById('arc-av-inp').click()" title="Click to change photo">
          <div id="arc-av-preview">${ava}</div>
          <div style="position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;border:2px solid var(--modal-bg)">${icon('edit', 10)}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:700;margin-bottom:2px">${esc(Profile.fullName())}</div>
          <div style="font-size:12px;color:var(--muted)">${esc(p.role || 'No role set')}</div>
          <div style="font-size:11px;color:var(--dim);margin-top:4px">Click avatar to change photo</div>
        </div>
        <input type="file" id="arc-av-inp" accept="image/*" style="display:none" onchange="arcHandleAvatar(event)">
        <input type="hidden" id="arc-av-data" value="${esc(p.avatar || '')}">
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-lbl">First Name</label><input class="form-inp" id="pf-fn" value="${esc(p.firstName)}" placeholder="First name"></div>
        <div class="form-group"><label class="form-lbl">Last Name</label><input class="form-inp" id="pf-ln" value="${esc(p.lastName)}" placeholder="Last name"></div>
      </div>
      <div class="form-group"><label class="form-lbl">Email</label><input class="form-inp" id="pf-em" type="email" value="${esc(p.email)}" placeholder="you@example.com"></div>
      <div class="form-group"><label class="form-lbl">Role / Title</label><input class="form-inp" id="pf-role" value="${esc(p.role)}" placeholder="e.g. Product Manager, Designer…"></div>
      <div class="form-group"><label class="form-lbl">Bio</label><textarea class="form-inp" id="pf-bio" rows="2" placeholder="A short bio…">${esc(p.bio)}</textarea></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="arcSaveProfile()">Save Profile</button>
      </div>
    </div>`);
  }

  // ── Global Label Manager ─────────────────────────────────────────────
  function openLabelManager(onClose) {
    function renderLabelList() {
      const ls = Labels.getAll();
      if (!ls.length) {
        return `<div style="padding:20px;text-align:center;color:var(--dim);font-size:13px">No labels yet — create your first one below.</div>`;
      }
      return `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;max-height:240px;overflow-y:auto">` +
        ls.map(l => `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border)" class="lm-row" data-lid="${l.id}">
          <div style="width:12px;height:12px;border-radius:50%;background:${l.color};flex-shrink:0"></div>
          <span id="lm-name-${l.id}" style="flex:1;font-size:13px;font-weight:500">${esc(l.name)}</span>
          <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 7px" onclick="arcLabelEdit('${l.id}')">Edit</button>
          <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 7px;color:var(--red)" onclick="arcLabelDel('${l.id}')">✕</button>
        </div>`).join('') +
        `</div>`;
    }
    const PRESET = Labels.PRESET_COLORS;
    const presetSwatches = PRESET.map((c,i) => `<div class="cswatch${i===0?' sel':''}" data-color="${c}" style="background:${c}" onclick="arcLmPickColor(this,'${c}')"></div>`).join('');
    showModal(`<div class="modal" style="max-width:460px">
      <div class="modal-hdr">
        <div><div class="modal-title">Manage Labels</div><div class="modal-sub">Labels are shared across tasks and goals</div></div>
        <button class="close-btn" onclick="arcLmClose()">✕</button>
      </div>
      <div id="lm-list">${renderLabelList()}</div>
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div id="lm-form-title" style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)">New Label</div>
          <button id="lm-cancel-btn" class="btn btn-ghost btn-sm" style="display:none;font-size:11px;padding:2px 8px" onclick="arcLmCancelEdit()">✕ Cancel</button>
        </div>
        <input type="hidden" id="lm-editing-id" value="">
        <input class="form-inp" id="lm-new-name" placeholder="Label name…" maxlength="32" style="margin-bottom:8px" onkeydown="if(event.key==='Enter')arcLmCreate()">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="color-picker" id="lm-cp" style="gap:4px;flex:1;flex-wrap:nowrap">${presetSwatches}</div>
          <input type="hidden" id="lm-color" value="${PRESET[0]}">
          <button id="lm-submit-btn" class="btn btn-primary btn-sm" style="white-space:nowrap;flex-shrink:0" onclick="arcLmCreate()">＋ Create</button>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" onclick="arcLmClose()">Done</button>
      </div>
    </div>`);
    // Store callback for when manager closes
    window._arcLmOnClose = onClose || null;
  }

  // ── Folder Auto-Save (File System Access API) ────────────────────────
  const FolderSave = (() => {
    const IDB = 'arcus_fs', ST = 'handles';
    function openIDB() {
      return new Promise((res, rej) => {
        const r = indexedDB.open(IDB, 1);
        r.onupgradeneeded = e => e.target.result.createObjectStore(ST);
        r.onsuccess = e => res(e.target.result);
        r.onerror = () => rej(r.error);
      });
    }
    async function getHandle() {
      try {
        const d = await openIDB();
        return new Promise(res => {
          const r = d.transaction(ST).objectStore(ST).get('dir');
          r.onsuccess = () => res(r.result || null);
          r.onerror = () => res(null);
        });
      } catch { return null; }
    }
    async function putHandle(h) {
      try {
        const d = await openIDB();
        return new Promise((res, rej) => {
          const tx = d.transaction(ST, 'readwrite');
          tx.objectStore(ST).put(h, 'dir');
          tx.oncomplete = () => res(true);
          tx.onerror = () => rej(false);
        });
      } catch { return false; }
    }
    async function delHandle() {
      try {
        const d = await openIDB();
        await new Promise((res, rej) => {
          const tx = d.transaction(ST, 'readwrite');
          tx.objectStore(ST).delete('dir');
          tx.oncomplete = res; tx.onerror = rej;
        });
      } catch {}
    }
    async function folderName() { const h = await getHandle(); return h ? h.name : null; }
    function buildData() {
      return { version: 3, exportedAt: new Date().toISOString(),
        profile: Profile.get(), projects: Projects.getAll(), goals: Goals.getAll(),
        notes: DB.get('arc_n') || {}, journals: DB.get('arc_j') || {},
        journals2: DB.get('arc_j2') || [], buckets: Buckets.getAll(),
        tasks: Tasks.getAll(), events: Events.getAll(), comments: Comments.getAll(),
        labels: Labels.getAll(), pinned: PinnedTasks.getAll() };
    }
    async function writeToHandle(h) {
      const perm = await h.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const r = await h.requestPermission({ mode: 'readwrite' });
        if (r !== 'granted') return false;
      }
      const fh = await h.getFileHandle('arcus-autosave.json', { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(buildData(), null, 2));
      await w.close();
      return true;
    }
    async function saveNow() {
      if (!window.showDirectoryPicker) return { ok: false, err: 'not_supported' };
      let h = await getHandle();
      if (!h) {
        try { h = await window.showDirectoryPicker({ mode: 'readwrite' }); await putHandle(h); }
        catch (e) { return { ok: false, err: e.name === 'AbortError' ? 'cancelled' : e.message }; }
      }
      try {
        const ok = await writeToHandle(h);
        return ok ? { ok: true, folder: h.name } : { ok: false, err: 'permission_denied' };
      } catch (e) { await delHandle(); return { ok: false, err: e.message }; }
    }
    async function pick() { await delHandle(); return saveNow(); }
    async function clear() { await delHandle(); }
    return { folderName, saveNow, pick, clear, supported: () => !!window.showDirectoryPicker };
  })();

  // ── Basic Settings Modal (can be overridden per-page) ────────────────
  async function openSettingsModal() {
    const theme = Settings.get('theme', 'dark');
    const ps = Projects.getAll().length, gs = Goals.getAll().length;
    const ts = Tasks.getAll().length, bs = Buckets.getAll().length;
    const fsSupported = FolderSave.supported();
    const fname = fsSupported ? await FolderSave.folderName() : null;

    showModal(`<div class="modal wide">
      <div class="modal-hdr">
        <div><div class="modal-title">Settings</div><div class="modal-sub">Preferences and data management</div></div>
        <button class="close-btn" onclick="closeModal()">✕</button>
      </div>
      <div style="margin-bottom:22px">
        <div class="ss-section-title">Appearance</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
          <div>
            <div style="font-size:13px;font-weight:500">Theme</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Choose your display mode</div>
          </div>
          <div class="theme-toggle">
            <button class="theme-btn ${theme==='dark'?'active':''}" onclick="arcSetTheme('dark')">${icon('moon', 13)} Dark</button>
            <button class="theme-btn ${theme==='light'?'active':''}" onclick="arcSetTheme('light')">${icon('sun', 13)} Light</button>
          </div>
        </div>
      </div>
      <div style="margin-bottom:22px">
        <div class="ss-section-title">Auto-Save to Folder</div>
        ${fsSupported ? `
          <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
            ${fname
              ? `Saving to <strong style="color:var(--text)">${esc(fname)}/</strong> as <code style="background:var(--s3);padding:1px 5px;border-radius:4px;font-size:11px">arcus-autosave.json</code>`
              : 'Pick a local folder — Arcus saves your data there as JSON automatically.'}
          </div>
          <div style="display:flex;gap:8px">
            ${fname
              ? `<button class="btn btn-ghost" id="fs-save-btn" style="flex:1;justify-content:center" onclick="arcFSSave(this)">${icon('download', 13)} Save Now</button>
                 <button class="btn btn-ghost" onclick="arcFSPick(this)">${icon('folder', 13)} Change Folder</button>
                 <button class="btn btn-ghost" style="color:var(--muted)" onclick="arcFSClear()">✕ Clear</button>`
              : `<button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="arcFSPick(this)">${icon('folder', 13)} Choose Save Folder…</button>`}
          </div>
        ` : `
          <div style="font-size:12px;color:var(--muted);background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 13px">
            Folder auto-save requires Chrome or Edge. Use <strong>Export Backup</strong> below to save your data as a file.
          </div>
        `}
      </div>
      <div style="margin-bottom:22px">
        <div class="ss-section-title">Your Data</div>
        <div style="display:flex;gap:28px;margin-bottom:14px">
          <div><div style="font-family:'Fraunces',serif;font-size:26px;font-weight:600;color:var(--accent);line-height:1">${ps}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Projects</div></div>
          <div><div style="font-family:'Fraunces',serif;font-size:26px;font-weight:600;color:var(--accent);line-height:1">${gs}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Goals</div></div>
          <div><div style="font-family:'Fraunces',serif;font-size:26px;font-weight:600;color:var(--accent);line-height:1">${ts}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Tasks</div></div>
          <div><div style="font-family:'Fraunces',serif;font-size:26px;font-weight:600;color:var(--accent);line-height:1">${bs}</div><div style="font-size:11px;color:var(--muted);margin-top:2px">Buckets</div></div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="Arc.exportAllData()">${icon('download', 13)} Export Backup</button>
          <button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="Arc.importData()">${icon('upload', 13)} Import Backup</button>
        </div>
        <div class="form-hint" style="margin-top:6px">Export saves all your data as a JSON file. Import replaces everything from a backup file.</div>
      </div>
      <div>
        <div class="ss-section-title">About</div>
        <div style="background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:14px 16px;font-size:12px;color:var(--muted);line-height:1.7">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:38px;height:38px;border-radius:9px;background:linear-gradient(135deg,#7b79f7,#a78bfa);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:'Fraunces',serif;font-size:21px;font-weight:700;color:#fff;letter-spacing:-1px">A</div>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text);letter-spacing:-.2px">Arcus Planner</div>
              <div style="font-size:11px;color:var(--dim);margin-top:1px">Version 3.0 &nbsp;·&nbsp; Personal Edition</div>
            </div>
          </div>
          <div style="margin-bottom:12px">A personal productivity suite combining Gantt-style goal planning, a flexible Kanban task board, and a rich multi-entry journal — all in one private, offline-first app. Your data never leaves your device.</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px">
            <span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:10px;background:rgba(123,121,247,.12);color:#7b79f7;border:1px solid rgba(123,121,247,.22);display:inline-flex;align-items:center;gap:5px">${icon('chart', 11)} Gantt Planner</span>
            <span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:10px;background:rgba(123,121,247,.12);color:#7b79f7;border:1px solid rgba(123,121,247,.22);display:inline-flex;align-items:center;gap:5px">${icon('columns', 11)} Kanban Board</span>
            <span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:10px;background:rgba(123,121,247,.12);color:#7b79f7;border:1px solid rgba(123,121,247,.22);display:inline-flex;align-items:center;gap:5px">${icon('book', 11)} Journal</span>
            <span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:10px;background:rgba(123,121,247,.12);color:#7b79f7;border:1px solid rgba(123,121,247,.22);display:inline-flex;align-items:center;gap:5px">${icon('calendar', 11)} Events</span>
            <span style="font-size:10px;font-weight:600;padding:2px 9px;border-radius:10px;background:rgba(123,121,247,.12);color:#7b79f7;border:1px solid rgba(123,121,247,.22);display:inline-flex;align-items:center;gap:5px">${icon('moon', 11)} Dark &amp; Light</span>
          </div>
          <div style="padding-top:10px;border-top:1px solid var(--border);font-size:11px;color:var(--dim);line-height:1.8">
            <div>© 2025 Arcus Labs, Inc. All rights reserved.</div>
            <div>Hosted on GitHub Pages &nbsp;·&nbsp; Built with vanilla HTML, CSS &amp; JavaScript</div>
          </div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" onclick="closeModal()">Done</button></div>
    </div>`);
  }

  // Generic synced-store access — pages must use this instead of writing
  // localStorage directly, or the change never reaches Firestore and the
  // cloud copy overwrites it on the next load.
  const dbGet = k => DB.get(k);
  const dbSet = (k, v) => DB.set(k, v);

  return { uid, esc, dateStr, today, icon, dbGet, dbSet, STATUSES, COLORS, PROJ_COLORS, EMOJIS, PRIORITIES,
           Settings, Profile, Projects, Goals, DEFAULT_BUCKETS, Buckets, Tasks, Events, Activity, Comments, Labels, PinnedTasks, Checklists, Shared, People, FolderSave,
           avatarHtml, applyTheme, navHtml, exportAllData, importData, openProfileModal, openSettingsModal, openLabelManager };
})();

// =====================================================================
// GLOBAL HANDLERS (called from inline onclick in modal HTML)
// =====================================================================
function arcHandleAvatar(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const src = ev.target.result;
    document.getElementById('arc-av-data').value = src;
    const preview = document.getElementById('arc-av-preview');
    if (preview) preview.innerHTML = `<img src="${src}" style="width:68px;height:68px;border-radius:50%;object-fit:cover" alt="avatar">`;
    // Update nav avatar live
    const navAva = document.querySelector('.nav-avatar-btn');
    if (navAva) navAva.innerHTML = Arc.avatarHtml(32);
  };
  reader.readAsDataURL(file);
}

function arcSaveProfile() {
  const updated = {
    ...Arc.Profile.get(),
    firstName: document.getElementById('pf-fn').value.trim(),
    lastName:  document.getElementById('pf-ln').value.trim(),
    email:     document.getElementById('pf-em').value.trim(),
    role:      document.getElementById('pf-role').value.trim(),
    bio:       document.getElementById('pf-bio').value.trim(),
    avatar:    document.getElementById('arc-av-data').value || Arc.Profile.get().avatar,
  };
  Arc.Profile.save(updated);
  closeModal();
  // Re-render nav avatar
  const navEl = document.getElementById('nav-container');
  if (navEl) {
    const activeLink = navEl.querySelector('.nav-link.active');
    const page = activeLink ? activeLink.getAttribute('href').replace('.html','').replace('index','home') : 'home';
    navEl.innerHTML = Arc.navHtml(page);
  }
  // Let page update greeting if needed
  if (typeof onProfileSaved === 'function') onProfileSaved();
}

function arcSetTheme(t) {
  Arc.applyTheme(t);
  Arc.Settings.set('theme', t);
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', (t==='dark'&&b.textContent.includes('Dark'))||(t==='light'&&b.textContent.includes('Light')));
  });
}

// Default openSettings — pages can override this after loading data.js
function openSettings() { Arc.openSettingsModal(); }

// ── Folder Save global handlers ───────────────────────────────────────
async function arcFSPick(btn) {
  const orig = btn ? btn.textContent : '';
  if (btn) btn.textContent = 'Picking…';
  const r = await Arc.FolderSave.pick();
  if (r.ok) { openSettings(); }
  else if (r.err !== 'cancelled') { alert('Could not access folder: ' + r.err); if (btn) btn.textContent = orig; }
  else if (btn) btn.textContent = orig;
}

async function arcFSSave(btn) {
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = 'Saving…'; btn.disabled = true;
  const r = await Arc.FolderSave.saveNow();
  if (r.ok) { btn.textContent = '✓ Saved!'; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000); }
  else { btn.textContent = orig; btn.disabled = false; alert('Save failed: ' + r.err); }
}

async function arcFSClear() {
  await Arc.FolderSave.clear();
  openSettings();
}

// ── Profile dropdown menu ─────────────────────────────────────────────
function arcToggleProfileMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('arc-pmenu');
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  menu.classList.toggle('open');
  if (!isOpen) {
    // Close when clicking outside
    setTimeout(() => {
      document.addEventListener('click', arcCloseProfileMenu, { once: true });
    }, 0);
  }
}
function arcCloseProfileMenu() {
  const menu = document.getElementById('arc-pmenu');
  if (menu) menu.classList.remove('open');
}

// ── Global Label Manager handlers ─────────────────────────────────────
function arcLmPickColor(el, c) {
  el.closest('#lm-cp').querySelectorAll('.cswatch').forEach(s => s.classList.remove('sel'));
  el.classList.add('sel');
  document.getElementById('lm-color').value = c;
}

// Shared list re-render (called after any create/edit/delete)
function arcLmRenderList() {
  const listEl = document.getElementById('lm-list');
  if (!listEl) return;
  const ls = Arc.Labels.getAll();
  if (!ls.length) {
    listEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--dim);font-size:13px">No labels yet — create your first one below.</div>`;
  } else {
    listEl.innerHTML = `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;max-height:240px;overflow-y:auto">` +
      ls.map(l => `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border)" class="lm-row" data-lid="${l.id}">
        <div style="width:12px;height:12px;border-radius:50%;background:${l.color};flex-shrink:0"></div>
        <span style="flex:1;font-size:13px;font-weight:500">${Arc.esc(l.name)}</span>
        <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 7px" onclick="arcLabelEdit('${l.id}')">Edit</button>
        <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 7px;color:var(--red)" onclick="arcLabelDel('${l.id}')">✕</button>
      </div>`).join('') +
      `</div>`;
  }
}

// Reset form back to "create" mode
function arcLmCancelEdit() {
  const nameEl  = document.getElementById('lm-new-name');
  const idEl    = document.getElementById('lm-editing-id');
  const titleEl = document.getElementById('lm-form-title');
  const cancelEl= document.getElementById('lm-cancel-btn');
  const submitEl= document.getElementById('lm-submit-btn');
  const colorEl = document.getElementById('lm-color');
  if (nameEl)  { nameEl.value = ''; nameEl.style.borderColor = ''; }
  if (idEl)    idEl.value = '';
  if (titleEl) titleEl.textContent = 'New Label';
  if (cancelEl) cancelEl.style.display = 'none';
  if (submitEl) submitEl.textContent = '＋ Create';
  // Reset colour picker to first preset
  const cp = document.getElementById('lm-cp');
  if (cp) {
    const swatches = cp.querySelectorAll('.cswatch');
    swatches.forEach((s, i) => s.classList.toggle('sel', i === 0));
    if (colorEl && swatches[0]) colorEl.value = swatches[0].dataset.color || '#7b79f7';
  }
}

function arcLmCreate() {
  const name    = (document.getElementById('lm-new-name')?.value || '').trim();
  const color   = document.getElementById('lm-color')?.value || '#7b79f7';
  const editing = document.getElementById('lm-editing-id')?.value || '';
  const nameEl  = document.getElementById('lm-new-name');
  if (!name) { if (nameEl) { nameEl.style.borderColor = 'var(--red)'; nameEl.focus(); } return; }

  if (editing) {
    // Update existing label
    const l = Arc.Labels.getById(editing);
    if (l) Arc.Labels.update({ ...l, name, color });
  } else {
    // Create new label
    Arc.Labels.add({ id: Arc.uid(), name, color });
  }
  arcLmRenderList();
  arcLmCancelEdit();
}

function arcLabelEdit(id) {
  const l = Arc.Labels.getById(id);
  if (!l) return;
  // Populate the form fields
  const nameEl   = document.getElementById('lm-new-name');
  const idEl     = document.getElementById('lm-editing-id');
  const colorEl  = document.getElementById('lm-color');
  const titleEl  = document.getElementById('lm-form-title');
  const cancelEl = document.getElementById('lm-cancel-btn');
  const submitEl = document.getElementById('lm-submit-btn');
  if (!nameEl) return;
  nameEl.value = l.name;
  nameEl.style.borderColor = '';
  if (idEl)     idEl.value = id;
  if (colorEl)  colorEl.value = l.color;
  if (titleEl)  titleEl.textContent = 'Edit Label';
  if (cancelEl) cancelEl.style.display = '';
  if (submitEl) submitEl.textContent = '✓ Save';
  // Highlight matching colour swatch (match by data-color attribute)
  const cp = document.getElementById('lm-cp');
  if (cp) {
    cp.querySelectorAll('.cswatch').forEach(s => {
      s.classList.toggle('sel', s.dataset.color === l.color);
    });
  }
  nameEl.focus();
  nameEl.select();
  // Scroll the form into view
  nameEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function arcLabelDel(id) {
  const l = Arc.Labels.getById(id);
  if (!l || !confirm(`Delete label "${l.name}"? It will be removed from all tasks and goals.`)) return;
  Arc.Labels.delete(id);
  // Also remove from tasks and goals
  const tasks = Arc.Tasks.getAll().map(t => ({ ...t, labels: (t.labels || []).filter(x => x !== id) }));
  Arc.Tasks.save(tasks);
  const goals = Arc.Goals.getAll().map(g => ({ ...g, labelIds: (g.labelIds || []).filter(x => x !== id) }));
  Arc.Goals.save(goals);
  arcLmRenderList();
  // If we were editing this label, cancel the edit
  if (document.getElementById('lm-editing-id')?.value === id) arcLmCancelEdit();
}

function arcLmClose() {
  closeModal();
  if (typeof window._arcLmOnClose === 'function') { const cb = window._arcLmOnClose; window._arcLmOnClose = null; cb(); }
}

// =====================================================================
// RICH TEXT EDITOR (shared by task updates and goal updates)
// Jira-style toolbar: text style, bold/italic/underline/strike, colour,
// lists, link, inline code, quote, clear formatting. Ctrl+Enter posts.
// =====================================================================
function renderRTE(id, placeholder) {
  return `<div class="rte-wrap" id="${id}-wrap">
    <div class="rte-toolbar">
      <select class="rte-select" id="${id}-style" onchange="rteHeading('${id}',this.value)" title="Text style">
        <option value="p" selected>Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <div class="rte-sep"></div>
      <button type="button" class="rte-btn" id="${id}-bold" title="Bold (Ctrl+B)" onclick="rteCmd('${id}','bold')"><b>B</b></button>
      <button type="button" class="rte-btn" id="${id}-italic" title="Italic (Ctrl+I)" onclick="rteCmd('${id}','italic')"><i>I</i></button>
      <button type="button" class="rte-btn" id="${id}-underline" title="Underline (Ctrl+U)" onclick="rteCmd('${id}','underline')"><u>U</u></button>
      <button type="button" class="rte-btn" id="${id}-strikeThrough" title="Strikethrough" onclick="rteCmd('${id}','strikeThrough')"><s>S</s></button>
      <div class="rte-sep"></div>
      <button type="button" class="rte-btn" title="Text colour" onclick="document.getElementById('${id}-clrinp').click()" style="position:relative">
        ${Arc.icon('droplet', 12)}
        <span class="rte-clr-bar" id="${id}-clrbar"></span>
      </button>
      <input type="color" class="rte-color-input" id="${id}-clrinp" value="#7b79f7" oninput="rteTextColor('${id}',this.value)">
      <div class="rte-sep"></div>
      <button type="button" class="rte-btn" title="Bullet list" onclick="rteCmd('${id}','insertUnorderedList')">${Arc.icon('list', 13)}</button>
      <button type="button" class="rte-btn rte-btn-txt" title="Numbered list" onclick="rteCmd('${id}','insertOrderedList')">1.</button>
      <div class="rte-sep"></div>
      <button type="button" class="rte-btn" title="Link" onclick="rteLink('${id}')">${Arc.icon('link', 12)}</button>
      <button type="button" class="rte-btn" title="Inline code" onclick="rteInlineCode('${id}')">${Arc.icon('code', 12)}</button>
      <button type="button" class="rte-btn rte-btn-txt" title="Quote" onclick="rteQuote('${id}')" style="font-family:Georgia,serif;font-size:15px;line-height:0">&rdquo;</button>
      <div class="rte-sep"></div>
      <button type="button" class="rte-btn rte-btn-txt" title="Clear formatting" onclick="rteClear('${id}')" style="font-size:11px;text-decoration:line-through">Aa</button>
    </div>
    <div class="rte-body" id="${id}-body" contenteditable="true"
      data-placeholder="${placeholder}"
      onkeyup="rteSyncStates('${id}')" onmouseup="rteSyncStates('${id}')"
      onkeydown="rteKeyDown(event,'${id}')"></div>
  </div>`;
}

function initRTE(id, entityId) {
  // Store entityId on the wrap so Ctrl+Enter can post against it
  const wrap = document.getElementById(`${id}-wrap`);
  if (wrap && entityId) wrap.dataset.entityId = entityId;
  const bar = document.getElementById(`${id}-clrbar`);
  if (bar) bar.style.background = '#7b79f7';
}

function rteCmd(id, cmd) {
  document.getElementById(`${id}-body`).focus();
  document.execCommand(cmd, false, null);
  rteSyncStates(id);
}

function rteSyncStates(id) {
  ['bold', 'italic', 'underline', 'strikeThrough'].forEach(cmd => {
    const btn = document.getElementById(`${id}-${cmd}`);
    if (btn) { try { btn.classList.toggle('active', document.queryCommandState(cmd)); } catch {} }
  });
}

function rteHeading(id, block) {
  document.getElementById(`${id}-body`).focus();
  document.execCommand('formatBlock', false, block);
}

function rteTextColor(id, color) {
  const bar = document.getElementById(`${id}-clrbar`);
  if (bar) bar.style.background = color;
  document.getElementById(`${id}-body`).focus();
  document.execCommand('foreColor', false, color);
}

function rteLink(id) {
  document.getElementById(`${id}-body`).focus();
  const url = prompt('Link URL:', 'https://');
  if (!url || url === 'https://') return;
  const sel = window.getSelection();
  if (sel && sel.toString()) {
    document.execCommand('createLink', false, url);
  } else {
    document.execCommand('insertHTML', false, `<a href="${Arc.esc(url)}" target="_blank">${Arc.esc(url)}</a>&nbsp;`);
  }
}

function rteInlineCode(id) {
  document.getElementById(`${id}-body`).focus();
  const sel = window.getSelection();
  const text = sel ? sel.toString() : '';
  if (!text) return;
  document.execCommand('insertHTML', false, `<code>${Arc.esc(text)}</code>&nbsp;`);
}

function rteQuote(id) {
  document.getElementById(`${id}-body`).focus();
  document.execCommand('formatBlock', false, 'blockquote');
}

function rteClear(id) {
  document.getElementById(`${id}-body`).focus();
  document.execCommand('removeFormat', false, null);
  document.execCommand('formatBlock', false, 'p');
  rteSyncStates(id);
}

function rteKeyDown(e, id) {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    const wrap = document.getElementById(`${id}-wrap`);
    const eid  = wrap?.dataset.entityId;
    if (eid && typeof postComment === 'function') postComment(eid);
  }
}

function getRteHtml(id) {
  const body = document.getElementById(`${id}-body`);
  return body ? body.innerHTML.trim() : '';
}

function clearRte(id) {
  const body = document.getElementById(`${id}-body`);
  if (body) body.innerHTML = '';
}

// ── Person avatar helper (used by tasks.html and people.html) ─────────
function arcPersonAva(p, size = 26) {
  const ini = (p.name || p.email || '?').charAt(0).toUpperCase();
  return p.photo
    ? `<img src="${Arc.esc(p.photo)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;display:block" alt="">`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#7b79f7,#a78bfa);color:#fff;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*.42)}px;font-weight:700;flex-shrink:0">${Arc.esc(ini)}</div>`;
}


// =====================================================================
// FIREBASE AUTH + FIRESTORE SYNC
// =====================================================================
const ARC_STORE_KEYS = [
  'arc_profile','arc_p','arc_g','arc_n','arc_j','arc_j2',
  'arc_buckets','arc_tasks','arc_ev','arc_comments',
  'arc_labels','arc_pinned','arc_checklists','arc_people_meta','arc_cfg',
];

function arcFirebaseInit() {
  // Skip if Firebase SDK not loaded or config not filled in
  if (!window.firebase) return;
  if (ARC_FIREBASE_CONFIG.apiKey.startsWith('REPLACE_')) {
    console.info('Arcus: Firebase not configured — running in local-only mode.');
    return;
  }
  if (firebase.apps.length) return; // Already initialized

  firebase.initializeApp(ARC_FIREBASE_CONFIG);
  window._arcDb = firebase.firestore();

  // Inject auth overlay into DOM
  arcInjectAuthOverlay();

  // Watch auth state
  firebase.auth().onAuthStateChanged(async user => {
    window._arcUser = user;
    if (user) {
      arcShowSyncBanner(true);
      const hadError = await arcLoadUserData(user.uid);
      // Load shared items + people directory, fold collaborators' edits into the local store
      await Promise.all([Arc.Shared.load(), Arc.People.load()]);
      Arc.Shared.applyMineToLocal();
      if (!hadError) arcShowSyncBanner(false);
      arcHideAuthOverlay();
      // Re-render the page with fresh cloud data
      const navEl = document.getElementById('nav-container');
      if (navEl) {
        const active = navEl.querySelector('.nav-link.active');
        const page = active ? active.getAttribute('href').replace('.html','').replace('index','home') : 'home';
        navEl.innerHTML = Arc.navHtml(page);
      }
      if (typeof init === 'function') init();
    } else {
      // Not signed in — show auth overlay unless user explicitly chose local-only mode.
      // arcShowAuthOverlay() also clears the session stamp so the overlay will
      // correctly re-block on the next cold load.
      if (localStorage.getItem('arc_local_mode') === '1') {
        arcHideAuthOverlay(); // ensure it stays hidden (sets arc_auth_ok)
      } else {
        arcShowAuthOverlay(); // clears arc_auth_ok, reveals the sign-in card
      }
    }
  });
}

// Returns true if there was an error (so the caller can leave the banner visible), false on success.
async function arcLoadUserData(uid) {
  try {
    const snap = await window._arcDb
      .collection('users').doc(uid).collection('store').get();

    if (!snap.empty) {
      // Pull all Firestore data into localStorage
      snap.forEach(doc => {
        const val = doc.data().value;
        if (val !== undefined) localStorage.setItem(doc.id, JSON.stringify(val));
      });
      console.info(`Arcus: loaded ${snap.size} records from Firestore ✓`);
    } else {
      // First time this account uses cloud — migrate local data up
      const hasLocal = ARC_STORE_KEYS.some(k => localStorage.getItem(k));
      if (hasLocal) {
        arcShowSyncBanner(true, '☁ Backing up your data to the cloud…');
        await arcUploadLocalData(uid);
        console.info('Arcus: initial upload complete ✓');
      }
    }
    return false; // no error
  } catch (e) {
    console.error('Arcus: Firestore load failed:', e);
    arcShowSyncBanner(true, '⚠ Could not sync — your local data is safe');
    setTimeout(() => arcShowSyncBanner(false), 5000);
    return true; // had error
  }
}

async function arcUploadLocalData(uid) {
  // Write each key individually so one failure (e.g. a 1 MB avatar) doesn't
  // silently block all other keys from reaching Firestore.
  const results = await Promise.allSettled(
    ARC_STORE_KEYS.map(async key => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      let value;
      try { value = JSON.parse(raw); } catch { return; }
      // Strip base64 avatar — exceeds Firestore's 1 MB document limit
      if (key === 'arc_profile' && value && value.avatar && value.avatar.startsWith('data:')) {
        value = { ...value, avatar: null };
      }
      await window._arcDb
        .collection('users').doc(uid).collection('store').doc(key)
        .set({ value, ts: Date.now() });
    })
  );
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) {
    console.warn(`Arcus: ${failed.length} key(s) failed to upload`, failed.map(r => r.reason));
  }
}

function arcSignInGoogle() {
  if (!window.firebase) return;
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(e => {
    console.error('Sign-in error:', e);
    const msg = document.getElementById('arc-auth-msg');
    if (msg) msg.textContent = 'Sign-in failed: ' + e.message;
  });
}

function arcSignOut() {
  if (!window.firebase) return;
  if (!confirm('Sign out of Arcus? Your data will remain safe in the cloud.')) return;
  firebase.auth().signOut().then(() => {
    // Do NOT clear localStorage — it stays as a local backup.
    // On the next sign-in, Firestore data is loaded and overwrites localStorage,
    // so there is no risk of seeing another user's data.
    // Clear session + local-mode flags so the auth screen shows after sign-out.
    sessionStorage.removeItem('arc_auth_ok');
    localStorage.removeItem('arc_local_mode');
    window.location.reload();
  });
}

// Called when the user clicks "Continue locally" on the auth overlay.
function arcContinueLocally() {
  localStorage.setItem('arc_local_mode', '1');
  arcHideAuthOverlay();
  // Re-render the nav immediately so the "Local only" badge and correct
  // profile menu appear without needing a page reload.
  const navEl = document.getElementById('nav-container');
  if (navEl) {
    const active = navEl.querySelector('.nav-link.active');
    const page = active ? active.getAttribute('href').replace('.html','').replace('index','home') : 'home';
    navEl.innerHTML = Arc.navHtml(page);
  }
}

// Called from the profile menu "Sign in to sync" item (when in local mode).
function arcSignInFromLocal() {
  localStorage.removeItem('arc_local_mode');
  arcShowAuthOverlay();
}

// ── Auth overlay (injected into DOM) ──────────────────────────────────
function arcInjectAuthOverlay() {
  if (document.getElementById('arc-auth-overlay')) return;
  const el = document.createElement('div');
  el.id = 'arc-auth-overlay';
  el.innerHTML = `
    <div class="arc-auth-card">
      <div class="arc-auth-logo">Arc<span>us</span></div>
      <div class="arc-auth-title">Welcome to Arcus</div>
      <div class="arc-auth-sub">Sign in to sync your planner across every device</div>
      <button class="arc-google-btn" onclick="arcSignInGoogle()">
        <svg width="18" height="18" viewBox="0 0 48 48" style="flex-shrink:0">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Sign in with Google
      </button>
      <div id="arc-auth-msg" style="font-size:12px;color:var(--red);margin-top:10px;min-height:16px"></div>
      <div class="arc-auth-divider"><span>or</span></div>
      <button class="arc-local-btn" onclick="arcContinueLocally()">Continue without signing in</button>
      <div class="arc-auth-local-note">Data stays on this device only — no cloud backup</div>
    </div>`;
  document.body.appendChild(el);

  // Block page content immediately to prevent a flash of unauthorised content,
  // BUT only if we haven't already confirmed auth in this browser session.
  // sessionStorage persists across page navigations in the same tab, so once
  // Firebase confirms sign-in we set 'arc_auth_ok' and subsequent navigations
  // skip the blocking overlay entirely — no more flash on tab switches.
  // Exceptions: local-only mode users bypass auth, and returning sessions skip it.
  if (
    localStorage.getItem('arc_local_mode') !== '1' &&
    !sessionStorage.getItem('arc_auth_ok')
  ) {
    el.classList.add('visible', 'arc-auth-loading');
  }
}

function arcShowAuthOverlay() {
  const el = document.getElementById('arc-auth-overlay');
  if (!el) return;
  // Auth came back as signed-out. Clear any stale session confirmation,
  // remove loading state, and reveal the sign-in card.
  sessionStorage.removeItem('arc_auth_ok');
  el.classList.remove('arc-auth-loading');
  el.classList.add('visible');
}

function arcHideAuthOverlay() {
  const el = document.getElementById('arc-auth-overlay');
  if (!el) return;
  // Auth confirmed (signed in or local mode) — stamp the session so future
  // page navigations in this tab don't trigger the blocking overlay again.
  sessionStorage.setItem('arc_auth_ok', '1');
  el.classList.remove('visible', 'arc-auth-loading');
}

// ── Sync banner (brief "Syncing…" indicator on new device) ────────────
function arcShowSyncBanner(show, msg) {
  let el = document.getElementById('arc-sync-banner');
  if (!el && show) {
    el = document.createElement('div');
    el.id = 'arc-sync-banner';
    document.body.appendChild(el);
  }
  if (el) {
    if (msg) el.textContent = msg;
    else if (show) el.textContent = '☁ Syncing your data…';
    el.classList.toggle('visible', show);
  }
}

// Auto-initialize when DOM is ready (Firebase SDK must be loaded before data.js)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arcFirebaseInit);
} else {
  arcFirebaseInit();
}
