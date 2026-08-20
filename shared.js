/**
 * GREY CORNER — Shared Core Library (shared.js)
 * Utilitaires partagés pour la suite d'applications Grey Corner Planning
 * Thème : Automne & Rentrée Élégante (Papier écru, Laiton, Terracotta, Vert Sauge)
 */
(function(root) {
  'use strict';

  const GC = root.GC || {};

  // ─── 1. SÉCURITÉ & HACHAGE SHA-256 (PIN) ───
  // Hash SHA-256 du code PIN maître '1975'
  GC.MASTER_PIN_HASH = "20ee235b5de5b36244da6f9aa1cbdd032a90867ba92276ccc8c38c0d0d57fcec";

  GC.hashPin = async function(str) {
    if (!str) return '';
    if (typeof window !== 'undefined' && window.crypto && crypto.subtle) {
      const enc = new TextEncoder().encode(String(str));
      const buf = await crypto.subtle.digest('SHA-256', enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return '';
  };

  GC.verifyPin = async function(inputPin, expectedHash = GC.MASTER_PIN_HASH) {
    if (!inputPin) return false;
    const hashed = await GC.hashPin(inputPin);
    return hashed === expectedHash;
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

  // ─── 7. DÉFILEMENT AUTOMATIQUE ───
  GC.scrollToElement = function(elementOrId, delay = 150) {
    setTimeout(() => {
      const el = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, delay);
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

})(typeof window !== 'undefined' ? window : globalThis);
