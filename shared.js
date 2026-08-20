/**
 * GREY CORNER — Shared Core Library (shared.js)
 * Utilitaires partagés pour la suite d'applications Grey Corner Planning
 * Thème : Automne & Rentrée Élégante (Papier écru, Laiton, Terracotta, Vert Sauge)
 */
(function(root) {
  'use strict';

  const GC = root.GC || {};

  // ─── 1. SÉCURITÉ & HACHAGE SHA-256 (PINs DÉDIÉS) ───
  // Hash SHA-256 du code PIN Staff Bar & Service '2010'
  GC.PIN_STAFF_HASH = "7d12ba56e9f8b3dc64f77c87318c4f37bc12cfbf1a37573cdf3e4fa683f20155";
  // Hash SHA-256 du code PIN Administrateur Générateurs & Cuisine '1975'
  GC.PIN_ADMIN_HASH = "20ee235b5de5b36244da6f9aa1cbdd032a90867ba92276ccc8c38c0d0d57fcec";
  GC.MASTER_PIN_HASH = GC.PIN_ADMIN_HASH;

  GC.hashPin = async function(str) {
    if (!str) return '';
    if (typeof window !== 'undefined' && window.crypto && crypto.subtle) {
      const enc = new TextEncoder().encode(String(str));
      const buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return '';
  };

  /**
   * Vérification du PIN selon le rôle :
   * - 'admin' : Seul le PIN 1975 est accepté (Générateurs, Cuisine Admin).
   * - 'staff' : Le PIN 2010 (Bar / Service) OU le PIN Admin 1975 est accepté.
   */
  GC.verifyPin = async function(inputPin, role = 'staff') {
    if (!inputPin) return false;
    const hashed = await GC.hashPin(inputPin);
    if (role === 'admin') {
      return hashed === GC.PIN_ADMIN_HASH;
    }
    // Rôle Staff : accepte 2010 (staff) ou 1975 (admin maître)
    return hashed === GC.PIN_STAFF_HASH || hashed === GC.PIN_ADMIN_HASH;
  };

  GC.verifyAdminPin = async function(inputPin) {
    return GC.verifyPin(inputPin, 'admin');
  };

  GC.verifyStaffPin = async function(inputPin) {
    return GC.verifyPin(inputPin, 'staff');
  };

  GC.isSessionAuth = function(key = 'gc_auth') {
    try {
      return sessionStorage.getItem(key) === '1';
    } catch (e) {
      return false;
    }
  };

  GC.setSessionAuth = function(key = 'gc_auth') {
    try {
      sessionStorage.setItem(key, '1');
    } catch (e) {}
  };

  GC.clearSessionAuth = function(key = 'gc_auth') {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {}
  };

  // ─── 1.B. SYSTÈME DE THÈMES FESTIFS HEBDOMADAIRES MULTI-COULEURS ───
  GC.FESTIVE_THEMES = [
    {
      id: 0,
      name: "Corail & Sunset Solaire",
      emoji: "🌅",
      primary: "#ff5757",
      secondary: "#ff8838",
      accent: "#f5b700",
      dark: "#9e1c1c",
      glowA: "rgba(255, 87, 87, 0.28)",
      glowB: "rgba(255, 136, 56, 0.28)",
      bgGradient: "linear-gradient(180deg, #fff7f2 0%, #ffefe5 50%, #fde4d4 100%)",
      palette: ["#ff5757", "#ff8838", "#f5b700", "#e03161", "#8b2671"]
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
      root.style.setProperty('--acc-1', '#ff7043'); // Lundi : Sunset Corail
      root.style.setProperty('--acc-2', '#10b981'); // Mardi : Vert Émeraude
      root.style.setProperty('--acc-3', '#2563eb'); // Mercredi : Bleu Azur
      root.style.setProperty('--acc-4', '#9333ea'); // Jeudi : Violet Pourpre
      root.style.setProperty('--acc-5', '#f43f5e'); // Vendredi : Rose Rubis
      root.style.setProperty('--acc-6', '#f59e0b'); // Samedi : Ambre Solaire
      root.style.setProperty('--acc-7', '#06b6d4'); // Dimanche : Lagon Turquoise
      
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
    const p = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_]/g, '').trim();
    if (p.includes('ter1')) return 'TER 1';
    if (p.includes('ter2')) return 'TER 2';
    if (p.includes('ter3')) return 'TER 3';
    if (p.includes('ter'))  return 'TER';
    if (p.includes('sal1') || p.includes('sala1')) return 'SAL 1';
    if (p.includes('sal2') || p.includes('sala2')) return 'SAL 2';
    if (p.includes('sal3') || p.includes('sala3')) return 'SAL 3';
    if (p.includes('sal')  || p.includes('sala'))  return 'SAL 1';
    if (p.includes('log'))  return 'LOGE';
    if (p.includes('deb'))  return 'DEB';
    if (p.includes('bar'))  return 'BAR';
    if (p.includes('cais')) return 'CAISSE';
    if (p.includes('run'))  return 'RUNNER';
    if (p.includes('acc'))  return 'ACCUEIL';
    return String(raw).substring(0, 6).toUpperCase();
  };

  GC.pickTime = function(raw, fallback) {
    const t = String(raw ?? '').trim();
    return (t && t !== '-') ? t : fallback;
  };

  // ─── 5. DATES & CALENDRIER EN FRANÇAIS ───
  GC.FRENCH_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  GC.FRENCH_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  GC.todayMidnight = function() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  GC.sameDay = function(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  GC.formatFrenchDate = function(dateObj) {
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
    const dayName = GC.FRENCH_DAYS[dateObj.getDay()];
    const dayNum  = dateObj.getDate();
    const month   = GC.FRENCH_MONTHS[dateObj.getMonth()];
    return `${dayName} ${dayNum} ${month}`;
  };

  GC.parseDateLabel = function(label) {
    const s = String(label ?? '').trim();
    if (!s || s.toUpperCase() === 'DATE') return null;

    // Format YYYY-MM-DD
    let m = s.match(/\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      d.setHours(0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }

    // Format DD/MM/YYYY
    m = s.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
    if (m) {
      const d = new Date(+m[3], +m[2] - 1, +m[1]);
      d.setHours(0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }

    // Format DD/MM
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})$/);
    if (m) {
      const d = new Date(new Date().getFullYear(), +m[2] - 1, +m[1]);
      d.setHours(0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
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
      const yr = m[3] ? +m[3] : new Date().getFullYear();
      const d  = new Date(yr, months[m[2]], +m[1]);
      d.setHours(0, 0, 0, 0);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
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
  root.escapeHtml = root.escapeHtml || GC.escapeHtml;
  root.isHtml = root.isHtml || GC.isHtml;
  root.splitCsv = root.splitCsv || GC.splitCsv;
  root.parseCsvLine = root.parseCsvLine || GC.parseCsvLine;
  root.cleanPoste = root.cleanPoste || GC.cleanPoste;
  root.pickTime = root.pickTime || GC.pickTime;
  root.todayMidnight = root.todayMidnight || GC.todayMidnight;
  root.sameDay = root.sameDay || GC.sameDay;
  root.formatFrenchDate = root.formatFrenchDate || GC.formatFrenchDate;
  root.parseDateLabel = root.parseDateLabel || GC.parseDateLabel;
  root.showAlert = root.showAlert || GC.showAlert;
  root.hideAlert = root.hideAlert || GC.hideAlert;
  root.showToast = root.showToast || GC.showToast;
  root.scrollToElement = root.scrollToElement || GC.scrollToElement;
  root.scrollToToday = root.scrollToToday || GC.scrollToToday;
  root.initTodayFAB = root.initTodayFAB || GC.initTodayFAB;

})(typeof window !== 'undefined' ? window : globalThis);
