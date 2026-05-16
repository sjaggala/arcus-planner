// Arcus Planner — Shared Data Layer (data.js)
// Loaded by all pages. Provides the Arc namespace + global modal/nav utilities.
// -----------------------------------------------------------------

'use strict';

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

// =====================================================================
// ARC NAMESPACE
// =====================================================================
const Arc = (() => {
  // ── Core Utilities ──────────────────────────────────────────────────
  const uid     = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc     = s  => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const dateStr = d  => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today   = () => dateStr(new Date());

  const DB = {
    get: k  => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
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
    save()      { localStorage.setItem('arc_cfg', JSON.stringify(this._d || {})); },
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
    { id: 'b_todo',   name: 'To Do',       color: '#6a74a0', statuses: ['not_started'],           isDefault: true, order: 0 },
    { id: 'b_prog',   name: 'In Progress', color: '#7b79f7', statuses: ['in_progress'],            isDefault: true, order: 1 },
    { id: 'b_review', name: 'In Review',   color: '#f5c542', statuses: [],                         isDefault: true, order: 2 },
    { id: 'b_hold',   name: 'On Hold',     color: '#fb923c', statuses: ['on_hold'],                isDefault: true, order: 3 },
    { id: 'b_done',   name: 'Done',        color: '#3ec97a', statuses: ['completed','cancelled'],  isDefault: true, order: 4 },
  ];

  // ── Buckets ──────────────────────────────────────────────────────────
  const Buckets = {
    getAll() {
      const s = DB.get('arc_buckets');
      if (!s || !s.length) { this.reset(); return DB.get('arc_buckets'); }
      return [...s].sort((a, b) => a.order - b.order);
    },
    save(bs)  { DB.set('arc_buckets', bs); },
    add(b)    { const bs = this.getAll(); b.order = Math.max(0, ...bs.map(x => x.order)) + 1; bs.push(b); this.save(bs); },
    update(b) { this.save(this.getAll().map(x => x.id === b.id ? b : x)); },
    delete(id, fallbackId) {
      // Move tasks in deleted bucket to fallback (To Do)
      const fb = fallbackId || 'b_todo';
      const ts = DB.get('arc_tasks') || [];
      DB.set('arc_tasks', ts.map(t => t.bucketId === id ? { ...t, bucketId: fb } : t));
      this.save(this.getAll().filter(b => b.id !== id));
    },
    reset()   { this.save(DEFAULT_BUCKETS.map(b => ({ ...b }))); },
    forGoal(goal) { return this.getAll().find(b => b.statuses && b.statuses.includes(goal.status)); },
  };

  // ── Tasks (standalone, non-goal tasks) ──────────────────────────────
  const Tasks = {
    getAll()     { return DB.get('arc_tasks') || []; },
    save(ts)     { DB.set('arc_tasks', ts); },
    add(t)       { const ts = this.getAll(); ts.push(t); this.save(ts); },
    update(t)    { this.save(this.getAll().map(x => x.id === t.id ? t : x)); },
    delete(id)   { this.save(this.getAll().filter(t => t.id !== id)); },
    pending()    { return this.getAll().filter(t => t.bucketId !== 'b_done'); },
    dueToday()   { const t = today(); return this.getAll().filter(x => x.dueDate === t && x.bucketId !== 'b_done'); },
    overdue()    { const t = today(); return this.getAll().filter(x => x.dueDate && x.dueDate < t && x.bucketId !== 'b_done'); },
  };

  // ── Avatar HTML ──────────────────────────────────────────────────────
  function avatarHtml(size = 34) {
    const p = Profile.get(), ini = Profile.initials();
    if (p.avatar) {
      return `<img src="${p.avatar}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,.15);display:block;flex-shrink:0" alt="avatar">`;
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
      { id: 'journal',  label: 'Journal',  href: 'journal.html' },
    ];
    const linksHtml = links.map(l =>
      `<a href="${l.href}" class="nav-link ${l.id === activePage ? 'active' : ''}">${l.label}</a>`
    ).join('');
    const ava = avatarHtml(32);
    return `<nav class="shared-nav">
      <a href="index.html" class="nav-logo">Arc<span>us</span></a>
      <div class="nav-links">${linksHtml}</div>
      <div class="nav-right">
        <button class="nav-avatar-btn" onclick="Arc.openProfileModal()" title="Your Profile">${ava}</button>
        <button class="nav-gear" onclick="openSettings()" title="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </nav>`;
  }

  // ── Data Export / Import ──────────────────────────────────────────────
  function exportAllData() {
    const data = {
      version: 2, exportedAt: new Date().toISOString(),
      profile: Profile.get(),
      projects: Projects.getAll(),
      goals: Goals.getAll(),
      notes: DB.get('arc_n') || {},
      journals: DB.get('arc_j') || {},
      buckets: Buckets.getAll(),
      tasks: Tasks.getAll(),
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
        if (d.profile)   Profile.save(d.profile);
        if (d.projects)  DB.set('arc_p', d.projects);
        if (d.goals)     DB.set('arc_g', d.goals);
        if (d.notes)     DB.set('arc_n', d.notes);
        if (d.journals)  DB.set('arc_j', d.journals);
        if (d.buckets)   DB.set('arc_buckets', d.buckets);
        if (d.tasks)     DB.set('arc_tasks', d.tasks);
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
          <div style="position:absolute;bottom:-2px;right:-2px;width:22px;height:22px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:2px solid var(--modal-bg)">✎</div>
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
      return { version: 2, exportedAt: new Date().toISOString(),
        profile: Profile.get(), projects: Projects.getAll(), goals: Goals.getAll(),
        notes: DB.get('arc_n') || {}, journals: DB.get('arc_j') || {},
        buckets: Buckets.getAll(), tasks: Tasks.getAll() };
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
            <button class="theme-btn ${theme==='dark'?'active':''}" onclick="arcSetTheme('dark')">🌙 Dark</button>
            <button class="theme-btn ${theme==='light'?'active':''}" onclick="arcSetTheme('light')">☀️ Light</button>
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
              ? `<button class="btn btn-ghost" id="fs-save-btn" style="flex:1;justify-content:center" onclick="arcFSSave(this)">⬇ Save Now</button>
                 <button class="btn btn-ghost" onclick="arcFSPick(this)">📁 Change Folder</button>
                 <button class="btn btn-ghost" style="color:var(--muted)" onclick="arcFSClear()">✕ Clear</button>`
              : `<button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="arcFSPick(this)">📁 Choose Save Folder…</button>`}
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
          <button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="Arc.exportAllData()">⬇ Export Backup</button>
          <button class="btn btn-ghost" style="flex:1;justify-content:center" onclick="Arc.importData()">⬆ Import Backup</button>
        </div>
        <div class="form-hint" style="margin-top:6px">Export saves all your data as a JSON file. Import replaces everything from a backup file.</div>
      </div>
      <div>
        <div class="ss-section-title">About</div>
        <div style="background:var(--s3);border:1px solid var(--border);border-radius:8px;padding:10px 13px;font-size:12px;color:var(--muted);line-height:1.7">
          <strong style="color:var(--text)">Arcus Planner v2</strong> — Gantt planner + Kanban board + Journal.<br>
          Single-origin app on GitHub Pages. All data stored locally in your browser.
        </div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" onclick="closeModal()">Done</button></div>
    </div>`);
  }

  return { uid, esc, dateStr, today, STATUSES, COLORS, PROJ_COLORS, EMOJIS, PRIORITIES,
           Settings, Profile, Projects, Goals, DEFAULT_BUCKETS, Buckets, Tasks, FolderSave,
           avatarHtml, applyTheme, navHtml, exportAllData, importData, openProfileModal, openSettingsModal };
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
