/**
 * GREY CORNER — Shared Core Library (shared.js)
 * Utilitaires partagés pour la suite d'applications Grey Corner Planning
 * Thème : Automne & Rentrée Élégante (Papier écru, Laiton, Terracotta, Vert Sauge)
 */
(function(root) {
  'use strict';

  const GC = root.GC || {};

  // ─── 1. SÉCURITÉ, ANTI-BRUTEFORCE, SESSIONS & RÔLES ───
  // NOTE D'ARCHITECTURE : Le hachage SHA-256 et le stockage de session côté navigateur
  // constituent uniquement un verrou d'interface utilisateur (accès vestiaires).
  // Ils ne protègent pas les données contre un utilisateur inspectant le code client.
  // La validation réelle des opérations d'écriture doit s'appuyer sur le backend
  // (jeton / secret vérifié côté Google Apps Script ou authentification Google).
  // Hash SHA-256 du code PIN Staff
  GC.PIN_STAFF_HASH = "7d12ba56e9f8b3dc64f77c87318c4f37bc12cfbf1a37573cdf3e4fa683f20155";
  // Hash SHA-256 du code PIN Administrateur (2008)
  GC.PIN_ADMIN_HASH = "e5e53c784d5d49de1cabb6e904bf3380026aadcb9769775a268dd304dd9aa2df";
  GC.MASTER_PIN_HASH = GC.PIN_ADMIN_HASH;

  GC.PIN_MAX_ATTEMPTS = 5;
  GC.PIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
  GC.PIN_LOCKOUT_KEY = 'gc_pin_lockout_v1';

  GC.SESSION_TTL_ADMIN_MS = 30 * 60 * 1000; // 30 minutes
  GC.SESSION_TTL_STAFF_MS = 8 * 60 * 60 * 1000; // 8 heures
  GC.ADMIN_SESSION_KEYS = ['gc_service_admin', 'gc_bar_admin', 'gc_cuisine_admin', 'gc_menage_admin'];
  GC.STAFF_SESSION_KEYS = ['gc_vestiaire_auth', 'gc_auth'];
  GC.lastPinError = '';

  GC.DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyJa4NlDqO9epWLvb97_DSo871acvtsfqMg_mRoCU1lsKJ0r9b2mYlpvYMW6ro7Y4vu/exec";
  GC.getWebhookUrl = function(customKey) {
    try {
      if (customKey) {
        const specific = (localStorage.getItem(customKey) || '').trim();
        if (specific) return specific;
      }
      const shared = (localStorage.getItem('gc_webhook_url') || '').trim();
      if (shared) return shared;
    } catch (e) {}
    return GC.DEFAULT_WEBHOOK_URL;
  };

  function readLockoutStore() {
    try {
      const raw = localStorage.getItem(GC.PIN_LOCKOUT_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeLockoutStore(store) {
    try {
      localStorage.setItem(GC.PIN_LOCKOUT_KEY, JSON.stringify(store));
    } catch (e) {}
  }

  GC.getPinLockoutStatus = function(scope = 'staff') {
    const store = readLockoutStore();
    const rec = store[scope] || { attempts: 0, lockedUntil: 0 };
    const now = Date.now();
    if (rec.lockedUntil && now < rec.lockedUntil) {
      const remainingMs = rec.lockedUntil - now;
      return {
        locked: true,
        remainingMs,
        remainingSec: Math.ceil(remainingMs / 1000),
        attempts: rec.attempts || GC.PIN_MAX_ATTEMPTS,
        remainingAttempts: 0
      };
    }
    if (rec.lockedUntil && now >= rec.lockedUntil) {
      delete store[scope];
      writeLockoutStore(store);
      return { locked: false, remainingMs: 0, remainingSec: 0, attempts: 0, remainingAttempts: GC.PIN_MAX_ATTEMPTS };
    }
    const attempts = rec.attempts || 0;
    return {
      locked: false,
      remainingMs: 0,
      remainingSec: 0,
      attempts,
      remainingAttempts: Math.max(0, GC.PIN_MAX_ATTEMPTS - attempts)
    };
  };

  GC.recordPinAttempt = function(scope = 'staff', success = false) {
    const store = readLockoutStore();
    if (success) {
      delete store[scope];
      writeLockoutStore(store);
      return { locked: false, remainingMs: 0, remainingSec: 0, attempts: 0, remainingAttempts: GC.PIN_MAX_ATTEMPTS };
    }
    const prev = store[scope] || { attempts: 0, lockedUntil: 0 };
    const attempts = (prev.attempts || 0) + 1;
    let lockedUntil = 0;
    if (attempts >= GC.PIN_MAX_ATTEMPTS) {
      lockedUntil = Date.now() + GC.PIN_LOCKOUT_MS;
    }
    store[scope] = { attempts, lockedUntil };
    writeLockoutStore(store);
    const locked = lockedUntil > 0;
    const remainingMs = locked ? (lockedUntil - Date.now()) : 0;
    return {
      locked,
      remainingMs,
      remainingSec: Math.ceil(remainingMs / 1000),
      attempts,
      remainingAttempts: Math.max(0, GC.PIN_MAX_ATTEMPTS - attempts)
    };
  };

  GC.resetPinLockout = function(scope) {
    if (!scope) {
      try { localStorage.removeItem(GC.PIN_LOCKOUT_KEY); } catch (e) {}
      return;
    }
    const store = readLockoutStore();
    delete store[scope];
    writeLockoutStore(store);
  };

  GC.hashPin = async function(str) {
    if (!str) return '';
    const subtle = (typeof crypto !== 'undefined' && crypto.subtle)
      ? crypto.subtle
      : (root && root.crypto && root.crypto.subtle ? root.crypto.subtle : null);
    if (subtle) {
      const enc = new TextEncoder().encode(String(str));
      const buf = await subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return '';
  };

  /**
   * Vérification du PIN selon le rôle avec limitation de tentatives (5 max / 5 min) :
   * - 'admin' : Seul le PIN Admin est accepté (Générateurs, Cuisine Admin, Ménage Admin).
   * - 'staff' : Le PIN Staff OU le PIN Admin est accepté (Vestiaires).
   */
  GC.verifyPin = async function(inputPin, role = 'staff') {
    const scope = (role === 'admin') ? 'admin' : 'staff';
    const lockStatus = GC.getPinLockoutStatus(scope);
    if (lockStatus.locked) {
      GC.lastPinError = `Trop de tentatives incorrectes. Réessayez dans ${lockStatus.remainingSec}s.`;
      return false;
    }
    if (!inputPin || String(inputPin).trim().length === 0) {
      GC.lastPinError = 'Saisissez un code PIN à 4 chiffres.';
      return false;
    }

    const hashed = await GC.hashPin(String(inputPin).trim());
    if (!hashed) {
      GC.lastPinError = 'Vérification cryptographique indisponible (HTTPS requis).';
      return false;
    }

    const isOk = (scope === 'admin')
      ? (hashed === GC.PIN_ADMIN_HASH)
      : (hashed === GC.PIN_STAFF_HASH || hashed === GC.PIN_ADMIN_HASH);

    if (isOk) {
      GC.recordPinAttempt(scope, true);
      GC.lastPinError = '';
      if (hashed === GC.PIN_ADMIN_HASH) {
        try { sessionStorage.setItem('gc_admin_token_hash', hashed); } catch (e) {}
      }
      return true;
    }

    const after = GC.recordPinAttempt(scope, false);
    if (after.locked) {
      GC.lastPinError = `Accès bloqué pendant ${after.remainingSec}s suite à ${GC.PIN_MAX_ATTEMPTS} échecs.`;
    } else {
      GC.lastPinError = `Code PIN incorrect (${after.remainingAttempts} essai(s) restant(s)).`;
    }
    return false;
  };

  GC.verifyAdminPin = async function(inputPin) {
    return GC.verifyPin(inputPin, 'admin');
  };

  GC.verifyStaffPin = async function(inputPin) {
    return GC.verifyPin(inputPin, 'staff');
  };

  GC.isSessionAuth = function(key = 'gc_auth', requiredRole) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return false;
      const mustBeAdmin = (requiredRole === 'admin') || GC.ADMIN_SESSION_KEYS.includes(key);
      const ttl = mustBeAdmin ? GC.SESSION_TTL_ADMIN_MS : GC.SESSION_TTL_STAFF_MS;

      let data;
      if (raw === '1') {
        // Migration d'une session legacy sans métadonnées : interdit pour admin par sécurité
        if (mustBeAdmin) {
          sessionStorage.removeItem(key);
          return false;
        }
        data = { auth: true, role: 'staff', createdAt: Date.now(), expiresAt: Date.now() + ttl };
        sessionStorage.setItem(key, JSON.stringify(data));
        return true;
      }

      data = JSON.parse(raw);
      if (!data || data.auth !== true) {
        sessionStorage.removeItem(key);
        return false;
      }

      const now = Date.now();
      if (!data.expiresAt || now > data.expiresAt) {
        sessionStorage.removeItem(key);
        if (mustBeAdmin) GC.cleanupUnusedAdminToken();
        return false;
      }

      if (mustBeAdmin && data.role !== 'admin') {
        return false;
      }

      // Fenêtre glissante à l'activité
      data.expiresAt = now + (data.role === 'admin' ? GC.SESSION_TTL_ADMIN_MS : GC.SESSION_TTL_STAFF_MS);
      sessionStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  };

  GC.setSessionAuth = function(key = 'gc_auth', role) {
    try {
      const isAdminKey = GC.ADMIN_SESSION_KEYS.includes(key);
      const effectiveRole = role || (isAdminKey ? 'admin' : 'staff');
      // Empêche une session staff de s'auto-élever en session admin
      if (isAdminKey && effectiveRole !== 'admin') return false;
      const ttl = (effectiveRole === 'admin') ? GC.SESSION_TTL_ADMIN_MS : GC.SESSION_TTL_STAFF_MS;
      const now = Date.now();
      sessionStorage.setItem(key, JSON.stringify({
        auth: true,
        role: effectiveRole,
        createdAt: now,
        expiresAt: now + ttl
      }));
      return true;
    } catch (e) {
      return false;
    }
  };

  GC.cleanupUnusedAdminToken = function() {
    try {
      const anyAdminActive = GC.ADMIN_SESSION_KEYS.some(k => {
        const raw = sessionStorage.getItem(k);
        if (!raw || raw === '1') return false;
        try {
          const parsed = JSON.parse(raw);
          return parsed && parsed.auth === true && parsed.role === 'admin' && parsed.expiresAt > Date.now();
        } catch (err) {
          return false;
        }
      });
      if (!anyAdminActive) {
        sessionStorage.removeItem('gc_admin_token_hash');
      }
    } catch (e) {}
  };

  GC.getAdminAuthToken = function() {
    try {
      const anyAdminActive = GC.ADMIN_SESSION_KEYS.some(k => GC.isSessionAuth(k, 'admin'));
      if (!anyAdminActive) return '';
      return sessionStorage.getItem('gc_admin_token_hash') || '';
    } catch (e) {
      return '';
    }
  };

  GC.clearSessionAuth = function(key = 'gc_auth') {
    try {
      sessionStorage.removeItem(key);
      if (GC.ADMIN_SESSION_KEYS.includes(key)) {
        GC.cleanupUnusedAdminToken();
      }
    } catch (e) {}
  };

  GC.logout = function(keyOrAll = 'all') {
    try {
      if (!keyOrAll || keyOrAll === 'all') {
        const allKeys = [...GC.ADMIN_SESSION_KEYS, ...GC.STAFF_SESSION_KEYS, 'gc_admin_token_hash'];
        allKeys.forEach(k => sessionStorage.removeItem(k));
        return;
      }
      sessionStorage.removeItem(keyOrAll);
      GC.cleanupUnusedAdminToken();
    } catch (e) {}
  };

  // ─── 1.B. SYSTÈME DE THÈMES FESTIFS HEBDOMADAIRES MULTI-COULEURS ───
  GC.FESTIVE_THEMES = [
    {
      id: 0,
      name: "Émeraude Impérial & Or de Fès",
      emoji: "👑",
      primary: "#0d382c",
      secondary: "#155e46",
      accent: "#f59e0b",
      dark: "#062b21",
      glowA: "rgba(13, 56, 44, 0.32)",
      glowB: "rgba(217, 119, 6, 0.26)",
      bgGradient: "linear-gradient(180deg, #fbf8f3 0%, #f7f1e7 50%, #efe5d5 100%)",
      palette: ["#0d382c", "#155e46", "#f59e0b", "#fbbf24", "#047857"]
    },
    {
      id: 1,
      name: "Émeraude & Menthe Royale",
      emoji: "🌿",
      primary: "#00b862",
      secondary: "#00c49f",
      accent: "#e5b700",
      dark: "#006b3a",
      glowA: "rgba(0, 184, 98, 0.26)",
      glowB: "rgba(0, 196, 159, 0.26)",
      bgGradient: "linear-gradient(180deg, #f0fdf4 0%, #e3f9eb 50%, #d1f3dc 100%)",
      palette: ["#00b862", "#00c49f", "#e5b700", "#059669", "#0d9488"]
    },
    {
      id: 2,
      name: "Océan & Lagon Électrique",
      emoji: "🌊",
      primary: "#2563eb",
      secondary: "#06b6d4",
      accent: "#f59e0b",
      dark: "#1e3a8a",
      glowA: "rgba(37, 99, 235, 0.26)",
      glowB: "rgba(6, 182, 212, 0.26)",
      bgGradient: "linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)",
      palette: ["#2563eb", "#06b6d4", "#f59e0b", "#4f46e5", "#0284c7"]
    },
    {
      id: 3,
      name: "Pourpre & Magenta Magique",
      emoji: "🎆",
      primary: "#d946ef",
      secondary: "#8b5cf6",
      accent: "#f43f5e",
      dark: "#701a75",
      glowA: "rgba(217, 70, 239, 0.26)",
      glowB: "rgba(139, 92, 246, 0.26)",
      bgGradient: "linear-gradient(180deg, #fdf4ff 0%, #fae8ff 50%, #f5d0fe 100%)",
      palette: ["#d946ef", "#8b5cf6", "#f43f5e", "#a855f7", "#ec4899"]
    },
    {
      id: 4,
      name: "Menthe & Émeraude Solaire",
      emoji: "🌿",
      primary: "#10b981",
      secondary: "#059669",
      accent: "#f59e0b",
      dark: "#065f46",
      glowA: "rgba(16, 185, 129, 0.26)",
      glowB: "rgba(5, 150, 105, 0.26)",
      bgGradient: "linear-gradient(180deg, #f0fdf4 0%, #e3f9eb 50%, #d1f3dc 100%)",
      palette: ["#10b981", "#059669", "#f59e0b", "#0d9488", "#34d399"]
    }
  ];

  GC.getWeekNumber = function(d = new Date()) {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  };

  GC.getCurrentFestiveTheme = function(offset = 0) {
    const weekNum = GC.getWeekNumber();
    const idx = (weekNum + offset) % GC.FESTIVE_THEMES.length;
    return GC.FESTIVE_THEMES[idx];
  };

  GC.applyFestiveTheme = function(themeIndex) {
    let theme;
    if (themeIndex !== undefined && GC.FESTIVE_THEMES[themeIndex]) {
      theme = GC.FESTIVE_THEMES[themeIndex];
    } else {
      theme = GC.getCurrentFestiveTheme();
    }

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--festive-primary', theme.primary);
      root.style.setProperty('--festive-secondary', theme.secondary);
      root.style.setProperty('--festive-accent', theme.accent);
      root.style.setProperty('--festive-dark', theme.dark);
      root.style.setProperty('--festive-bg', theme.bgGradient);
      root.style.setProperty('--festive-glow-a', theme.glowA);
      root.style.setProperty('--acc-1', '#0d382c'); // Lundi : Vert Émeraude Impérial
      root.style.setProperty('--acc-2', '#d97706'); // Mardi : Or Brossé & Miel Doré
      root.style.setProperty('--acc-3', '#c2410c'); // Mercredi : Terracotta & Cuivre Royal
      root.style.setProperty('--acc-4', '#047857'); // Jeudi : Vert Sauge Palace
      root.style.setProperty('--acc-5', '#b45309'); // Vendredi : Ambre Solaire
      root.style.setProperty('--acc-6', '#064e3b'); // Samedi : Nuit Émeraude & Or Intense
      root.style.setProperty('--acc-7', '#a16207'); // Dimanche : Champagne Soyeux & Or Antique
      
      document.body.classList.remove('theme-0', 'theme-1', 'theme-2', 'theme-3', 'theme-4');
      document.body.classList.add(`theme-${theme.id}`);

      // Mettre à jour l'indicateur de semaine sobre et clair
      const badge = document.getElementById('festive-badge');
      if (badge) {
        const weekNum = GC.getWeekNumber();
        badge.innerHTML = `✨ Semaine N°${weekNum} • Grey Corner`;
      }
    }
    return theme;
  };

  // Initialisation automatique du thème festif et du bouton FAB
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      GC.applyFestiveTheme();
      setTimeout(() => GC.initTodayFAB(), 150);
    });
  }

  // ─── 2. ESCAPING & STRING HELPERS ───
  GC.escapeHtml = function(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  };

  GC.isHtml = function(text) {
    return /<html[\s>]/i.test(text) || /<!doctype html/i.test(text);
  };

  // ─── 3. CSV PARSING ───
  GC.parseCsvLine = function(line) {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
        continue;
      }
      if (ch === ',' && !inQ) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  GC.splitCsv = function(line) {
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
  };

  // ─── 4. NORMALISATION ROBUSTE DES POSTES ───
  GC.cleanPoste = function(raw) {
    if (!raw) return '';
    const str = String(raw).trim();
    const is10h = /10\s*h|coup|contin/i.test(str);
    const p = str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]/g, '').trim();
    let base = '';
    if (p.includes('ter1')) base = 'TER 1';
    else if (p.includes('ter2')) base = 'TER 2';
    else if (p.includes('ter3')) base = 'TER 3';
    else if (p.includes('ter'))  base = 'TER';
    else if (p.includes('sal1') || p.includes('sala1')) base = 'SAL 1';
    else if (p.includes('sal2') || p.includes('sala2')) base = 'SAL 2';
    else if (p.includes('sal3') || p.includes('sala3')) base = 'SAL 3';
    else if (p.includes('sal')  || p.includes('sala'))  base = 'SAL 1';
    else if (p.includes('log'))  base = 'LOGE';
    else if (p.includes('deb'))  base = 'DEB';
    else if (p.includes('bar'))  base = 'BAR';
    else if (p.includes('cais')) base = 'CAISSE';
    else if (p.includes('run'))  base = 'RUNNER';
    else if (p.includes('acc'))  base = 'ACCUEIL';
    else if (is10h) base = 'CONTINU';
    else base = str.substring(0, 6).toUpperCase();

    if (is10h && !base.includes('10H')) {
      return `${base} • 10H`;
    }
    return base;
  };

  GC.pickTime = function(raw, fallback) {
    const t = String(raw ?? '').trim();
    return (t && t !== '-') ? t : fallback;
  };

  // ─── 5. DATES & CALENDRIER EN FRANÇAIS ───
  GC.FRENCH_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  GC.FRENCH_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  GC.isValidDate = function(d) {
    return d instanceof Date && !isNaN(d.getTime());
  };

  GC.createSafeLocalDate = function(year, monthIndex, day) {
    if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || !Number.isInteger(day)) return null;
    if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;
    const d = new Date(year, monthIndex, day, 0, 0, 0, 0);
    if (isNaN(d.getTime())) return null;
    if (d.getFullYear() !== year || d.getMonth() !== monthIndex || d.getDate() !== day) return null;
    return d;
  };

  GC.todayMidnight = function() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  };

  GC.sameDay = function(a, b) {
    return GC.isValidDate(a) && GC.isValidDate(b) &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  };

  GC.formatFrenchDate = function(dateObj) {
    if (!GC.isValidDate(dateObj)) return '';
    const dayName = GC.FRENCH_DAYS[dateObj.getDay()];
    const dayNum  = dateObj.getDate();
    const month   = GC.FRENCH_MONTHS[dateObj.getMonth()];
    return `${dayName} ${dayNum} ${month}`;
  };

  function resolveYearWithoutExplicitYear(monthIndex, day, refDate) {
    const baseYear = refDate.getFullYear();
    const candidate = GC.createSafeLocalDate(baseYear, monthIndex, day);
    if (!candidate) return null;
    const diffDays = (candidate.getTime() - refDate.getTime()) / 86400000;
    if (diffDays < -180) {
      return GC.createSafeLocalDate(baseYear + 1, monthIndex, day);
    }
    if (diffDays > 180) {
      return GC.createSafeLocalDate(baseYear - 1, monthIndex, day);
    }
    return candidate;
  }

  GC.parseDateLabel = function(label, refDate) {
    const s = String(label ?? '').trim();
    if (!s || s.toUpperCase() === 'DATE') return null;

    const ref = GC.isValidDate(refDate)
      ? new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0)
      : GC.todayMidnight();

    // Format YYYY-MM-DD ou YYYY/MM/DD
    let m = s.match(/\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
    if (m) {
      return GC.createSafeLocalDate(+m[1], +m[2] - 1, +m[3]);
    }

    // Format DD/MM/YYYY ou DD-MM-YYYY
    m = s.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
    if (m) {
      return GC.createSafeLocalDate(+m[3], +m[2] - 1, +m[1]);
    }

    // Format DD/MM sans année
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})$/);
    if (m) {
      return resolveYearWithoutExplicitYear(+m[2] - 1, +m[1], ref);
    }

    // Mois FR (complet + abrégé)
    const months = {
      'janvier': 0, 'janv': 0, 'jan': 0,
      'fevrier': 1, 'fevr': 1, 'fev': 1,
      'mars': 2, 'mar': 2,
      'avril': 3, 'avr': 3,
      'mai': 4,
      'juin': 5,
      'juillet': 6, 'juil': 6, 'jui': 6,
      'aout': 7, 'aou': 7,
      'septembre': 8, 'sept': 8, 'sep': 8,
      'octobre': 9, 'oct': 9,
      'novembre': 10, 'nov': 10,
      'decembre': 11, 'dec': 11
    };

    const low = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\./g, '');
    m = low.match(/\b(\d{1,2})\s+([a-z]+)\b(?:\s+(\d{4}))?/);
    if (m && months[m[2]] !== undefined) {
      const monthIdx = months[m[2]];
      const dayNum = +m[1];
      if (m[3]) {
        return GC.createSafeLocalDate(+m[3], monthIdx, dayNum);
      }
      return resolveYearWithoutExplicitYear(monthIdx, dayNum, ref);
    }

    return null;
  };

  GC.filterActivePlanningRows = function(rows, refDate) {
    if (!Array.isArray(rows) || !rows.length) return [];
    const ref = GC.isValidDate(refDate)
      ? new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0)
      : GC.todayMidnight();

    const normalized = rows
      .filter(r => r && r.date && !String(r.date).trim().toUpperCase().startsWith('DATE'))
      .map(r => {
        const parsed = GC.isValidDate(r.dateObj) ? r.dateObj : GC.parseDateLabel(r.date, ref);
        return Object.assign({}, r, { dateObj: parsed });
      });

    const validDated = normalized.filter(r => GC.isValidDate(r.dateObj));
    if (validDated.length > 0) {
      return validDated.filter(r => r.dateObj.getTime() >= ref.getTime());
    }
    return normalized;
  };

  GC.findTodayRowIndex = function(rows, refDate) {
    if (!Array.isArray(rows) || !rows.length) return -1;
    const ref = GC.isValidDate(refDate) ? refDate : GC.todayMidnight();
    const exactIdx = rows.findIndex(r => GC.isValidDate(r.dateObj) && GC.sameDay(r.dateObj, ref));
    if (exactIdx !== -1) return exactIdx;
    const anyDated = rows.some(r => GC.isValidDate(r.dateObj));
    if (anyDated) return -1;
    const todayDayName = (GC.FRENCH_DAYS && GC.FRENCH_DAYS[ref.getDay()]) ? GC.FRENCH_DAYS[ref.getDay()].toLowerCase() : '';
    return todayDayName ? rows.findIndex(r => r.date && String(r.date).toLowerCase().includes(todayDayName)) : -1;
  };

  // ─── 6. NOTIFICATIONS UI (ALERTE & TOAST) ───
  GC.showAlert = function(msg, boxId = 'alert-box', textId = 'alert-text') {
    const box = document.getElementById(boxId);
    const txt = document.getElementById(textId);
    if (!box || !txt) return;
    txt.textContent = msg;
    box.style.display = 'block';
    document.body.classList.add('has-alert');
  };

  GC.hideAlert = function(boxId = 'alert-box') {
    const box = document.getElementById(boxId);
    if (!box) return;
    box.style.display = 'none';
    document.body.classList.remove('has-alert');
  };

  GC.showToast = function(msg, duration = 3200, toastId = 'toast') {
    const toast = document.getElementById(toastId);
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('active');
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('active');
      toast.classList.remove('show');
    }, duration);
  };

  // ─── 7. DÉFILEMENT CENTRÉ SUR MOBILE & BOUTON FLOTTANT ───
  GC.scrollToElement = function(elementOrId, delay = 150) {
    setTimeout(() => {
      const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }, delay);
  };

  GC.scrollToToday = function(delay = 50) {
    setTimeout(() => {
      let el = document.getElementById('today-card') || 
               document.querySelector('.day-card.is-today') || 
               document.querySelector('.day-card[data-today="true"]');

      if (!el) {
        const todayDayName = (GC.FRENCH_DAYS && GC.FRENCH_DAYS[new Date().getDay()]) ? GC.FRENCH_DAYS[new Date().getDay()].toLowerCase() : '';
        const cards = document.querySelectorAll('.day-card');
        for (const card of cards) {
          const text = card.textContent.toLowerCase();
          if (todayDayName && text.includes(todayDayName)) {
            el = card;
            break;
          }
        }
      }

      if (!el) {
        el = document.querySelector('.day-card');
      }

      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }, delay);
  };

  GC.initTodayFAB = function() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('fab-today')) return;
    
    // Ne pas afficher sur le menu principal ou générateur
    const pathname = window.location.pathname.toLowerCase();
    if (pathname.endsWith('index.html') || pathname.endsWith('generateur.html') || document.querySelector('.nav-list')) {
      return;
    }

    const fab = document.createElement('button');
    fab.id = 'fab-today';
    fab.className = 'fab-today';
    fab.setAttribute('aria-label', "Aller au jour d'aujourd'hui");
    fab.innerHTML = `<span class="fab-icon">📍</span><span>Aujourd'hui</span>`;
    fab.onclick = (e) => {
      e.preventDefault();
      GC.scrollToToday(20);
    };
    document.body.appendChild(fab);
  };

  // ─── RÉTROCOMPATIBILITÉ GLOBALE DIRECTE ───
  root.GC = GC;
  root.MASTER_PIN_HASH = GC.MASTER_PIN_HASH;
  root.verifyPin = GC.verifyPin;
  root.hashPin = GC.hashPin;
  root.logout = GC.logout;
  root.escapeHtml = root.escapeHtml || GC.escapeHtml;
  root.isHtml = root.isHtml || GC.isHtml;
  root.splitCsv = root.splitCsv || GC.splitCsv;
  root.parseCsvLine = root.parseCsvLine || GC.parseCsvLine;
  root.cleanPoste = root.cleanPoste || GC.cleanPoste;
  root.pickTime = root.pickTime || GC.pickTime;
  root.isValidDate = root.isValidDate || GC.isValidDate;
  root.createSafeLocalDate = root.createSafeLocalDate || GC.createSafeLocalDate;
  root.todayMidnight = root.todayMidnight || GC.todayMidnight;
  root.sameDay = root.sameDay || GC.sameDay;
  root.formatFrenchDate = root.formatFrenchDate || GC.formatFrenchDate;
  root.parseDateLabel = root.parseDateLabel || GC.parseDateLabel;
  root.filterActivePlanningRows = root.filterActivePlanningRows || GC.filterActivePlanningRows;
  root.findTodayRowIndex = root.findTodayRowIndex || GC.findTodayRowIndex;
  root.showAlert = root.showAlert || GC.showAlert;
  root.hideAlert = root.hideAlert || GC.hideAlert;
  root.showToast = root.showToast || GC.showToast;
  root.scrollToElement = root.scrollToElement || GC.scrollToElement;
  root.scrollToToday = root.scrollToToday || GC.scrollToToday;
  root.initTodayFAB = root.initTodayFAB || GC.initTodayFAB;

})(typeof window !== 'undefined' ? window : globalThis);
