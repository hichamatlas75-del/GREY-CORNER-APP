/**
 * GREY CORNER — Planning Service (Administration & Générateur)
 * Module extrait pour alléger service.html et optimiser les performances
 */
(function(window) {
  'use strict';

  /* ════════════════════════════════════════════════════════════════════
     1. GESTION DU CODE PIN ADMINISTRATEUR
     ════════════════════════════════════════════════════════════════════ */
  let adminPinInput = "";
  const pinModal       = document.getElementById("pinModal");
  const pinBox         = document.getElementById("pinBox");
  const adminPinDots   = Array.from(document.querySelectorAll(".admin-pin-dot"));
  const adminPinError  = document.getElementById("adminPinError");
  const generatorModal = document.getElementById("generatorModal");

  function openPinModal() {
    if (GC.isSessionAuth("gc_service_admin")) {
      openGeneratorDashboard();
      return;
    }
    adminPinInput = "";
    updateAdminDots();
    if (adminPinError) adminPinError.textContent = "";
    if (pinModal) pinModal.classList.add("active");
  }

  function closePinModal() {
    if (pinModal) pinModal.classList.remove("active");
  }

  function updateAdminDots() {
    adminPinDots.forEach((d, i) => d.classList.toggle("filled", i < adminPinInput.length));
  }

  function clearAdminPin() {
    adminPinInput = "";
    if (adminPinError) adminPinError.textContent = "";
    updateAdminDots();
  }

  async function submitAdminPin() {
    const lockStatus = GC.getPinLockoutStatus("admin");
    if (lockStatus.locked) {
      if (adminPinError) adminPinError.textContent = `Trop de tentatives incorrectes. Réessayez dans ${lockStatus.remainingSec}s.`;
      return;
    }
    if (adminPinInput.length !== 4) {
      if (adminPinError) adminPinError.textContent = "Entrez le code à 4 chiffres.";
      return;
    }
    const isValid = await GC.verifyAdminPin(adminPinInput);
    if (isValid) {
      GC.setSessionAuth("gc_service_admin", "admin");
      closePinModal();
      openGeneratorDashboard();
    } else {
      if (adminPinError) adminPinError.textContent = GC.lastPinError || "Code PIN Admin incorrect. Réessayez.";
      adminPinInput = "";
      updateAdminDots();
      if (pinBox) {
        pinBox.classList.remove("shake");
        void pinBox.offsetWidth;
        pinBox.classList.add("shake");
      }
    }
  }

  function logoutServiceAdmin() {
    GC.logout("gc_service_admin");
    closeGeneratorModal();
    GC.showToast("🔒 Session administrateur fermée.");
  }

  // Événements clavier et pavé numérique PIN
  document.querySelectorAll(".admin-pin-panel [data-digit]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (adminPinInput.length >= 4) return;
      adminPinInput += btn.dataset.digit;
      if (adminPinError) adminPinError.textContent = "";
      updateAdminDots();
      if (adminPinInput.length === 4) setTimeout(submitAdminPin, 130);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (!pinModal || !pinModal.classList.contains("active")) return;
    if (e.key >= "0" && e.key <= "9") {
      if (adminPinInput.length >= 4) return;
      adminPinInput += e.key;
      if (adminPinError) adminPinError.textContent = "";
      updateAdminDots();
      if (adminPinInput.length === 4) setTimeout(submitAdminPin, 130);
    } else if (e.key === "Backspace") {
      adminPinInput = adminPinInput.slice(0, -1);
      updateAdminDots();
    } else if (e.key === "Enter") {
      submitAdminPin();
    } else if (e.key === "Escape") {
      closePinModal();
    }
  });

  /* ════════════════════════════════════════════════════════════════════
     2. GESTIONNAIRE DU DASHBOARD GÉNÉRATEUR
     ════════════════════════════════════════════════════════════════════ */
  function openGeneratorDashboard() {
    let nextMonday = null;
    if (window.lastSheetDate instanceof Date && !isNaN(window.lastSheetDate)) {
      const d = new Date(window.lastSheetDate);
      d.setDate(d.getDate() + 1);
      const day = d.getDay();
      const diff = d.getDate() + (day === 0 ? 1 : (day === 1 ? 0 : 8 - day));
      nextMonday = new Date(d.setDate(diff));
    } else {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      nextMonday = new Date(d.setDate(diff));
    }
    
    const yyyy = nextMonday.getFullYear();
    const mm = String(nextMonday.getMonth() + 1).padStart(2, '0');
    const dd = String(nextMonday.getDate()).padStart(2, '0');
    const startInput = document.getElementById("genStartDate");
    if (startInput) startInput.value = `${yyyy}-${mm}-${dd}`;

    loadTeamNames();
    loadWebhookUrl();
    initAppsScriptPreview();
    checkForPendingDraft();
    if (generatorModal) generatorModal.classList.add("active");
  }

  function closeGeneratorModal() {
    if (generatorModal) generatorModal.classList.remove("active");
  }

  /* ════════════════════════════════════════════════════════════════════
     3. CODE GOOGLE APPS SCRIPT WEBHOOK EMBARQUÉ
     ════════════════════════════════════════════════════════════════════ */
  const APPS_SCRIPT_CODE = `/**
 * GREY CORNER — WEBHOOK PLANNING CENTRALISÉ (SERVICE, CUISINE, MÉNAGE)
 * Workflow Chronologique : Ajout sous le dernier planning avec 1 ligne sautée
 * Formatage strict en français sans mention GMT/UTC dans la Colonne A
 *
 * NOTE SÉCURITÉ SERVEUR :
 * Pour exiger un secret côté serveur sur les écritures (doPost), ajoutez une propriété
 * "ADMIN_WRITE_SECRET" dans Extensions > Apps Script > Paramètres du projet > Propriétés de script.
 */

var EXPECTED_ADMIN_HASH = "e5e53c784d5d49de1cabb6e904bf3380026aadcb9769775a268dd304dd9aa2df";

function formatToFrenchDateString(val) {
  if (val === null || val === undefined || val === "") return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    var days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
    var months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
    return days[val.getDay()] + " " + val.getDate() + " " + months[val.getMonth()];
  }
  var s = String(val).trim();
  if (s.indexOf("GMT") !== -1 || s.indexOf("UTC") !== -1) {
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      var days = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
      var months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
      return days[parsed.getDay()] + " " + parsed.getDate() + " " + months[parsed.getMonth()];
    }
  }
  return s;
}

function verifyWriteAuthorization(payload) {
  try {
    var props = PropertiesService.getScriptProperties();
    var serverSecret = props ? props.getProperty("ADMIN_WRITE_SECRET") : "";
    if (serverSecret && payload.authSecret !== serverSecret) {
      return false;
    }
  } catch (e) {}
  if (payload && payload.authHash !== undefined && payload.authHash !== "" && payload.authHash !== EXPECTED_ADMIN_HASH) {
    return false;
  }
  return true;
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    if (!verifyWriteAuthorization(payload)) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Autorisation administrateur invalide ou refusée."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const action = payload.action || "save_draft";
    const newRows = payload.rows || [];

    if (action === "save_cuisine") {
      var cuisineData = payload.cuisineData || [];
      var cSheet = ss.getSheetByName("CUISINE") || ss.insertSheet("CUISINE");
      var cMatrix = [["JOUR", "MEMBRE", "GENRE", "HORAIRE"]];
      cuisineData.forEach(function(dayItem) {
        var dayName = String(dayItem.dayName || "");
        var staffArr = Array.isArray(dayItem.staff) ? dayItem.staff : [];
        staffArr.forEach(function(m) {
          cMatrix.push([dayName, String(m.name || ""), String(m.gender || "homme"), String(m.badge || "")]);
        });
      });
      cSheet.clear();
      var cRange = cSheet.getRange(1, 1, cMatrix.length, 4);
      cRange.setValues(cMatrix);
      cSheet.getRange(1, 1, 1, 4).setFontWeight("bold");
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        stage: "cuisine",
        message: "Planning Cuisine synchronisé dans l'onglet CUISINE",
        count: cMatrix.length - 1
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "save_menage") {
      var menageData = payload.menageData || {};
      var mSheet = ss.getSheetByName("MENAGE") || ss.insertSheet("MENAGE");
      var mMatrix = [["SEMAINE", "JOUR", "MATIN", "SOIR"]];
      ["S1", "S2"].forEach(function(wk) {
        var wkObj = menageData[wk];
        if (wkObj && Array.isArray(wkObj.schedules)) {
          wkObj.schedules.forEach(function(r) {
            mMatrix.push([wk, String(r.day || ""), String((r.matin && r.matin.staff) || ""), String((r.soir && r.soir.staff) || "")]);
          });
        }
      });
      mSheet.clear();
      var mRange = mSheet.getRange(1, 1, mMatrix.length, 4);
      mRange.setValues(mMatrix);
      mSheet.getRange(1, 1, 1, 4).setFontWeight("bold");
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        stage: "menage",
        message: "Planning Ménage synchronisé dans l'onglet MENAGE",
        count: mMatrix.length - 1
      })).setMimeType(ContentService.MimeType.JSON);
    }

    let draftSheet = ss.getSheetByName("BROUILLON");
    if (!draftSheet) draftSheet = ss.insertSheet("BROUILLON");

    let liveSheet = ss.getSheetByName("Feuille 1");
    if (!liveSheet) {
      const allSheets = ss.getSheets();
      for (let s = 0; s < allSheets.length; s++) {
        if (allSheets[s].getName() !== "BROUILLON" && allSheets[s].getName() !== "CUISINE" && allSheets[s].getName() !== "MENAGE") {
          liveSheet = allSheets[s];
          break;
        }
      }
    }
    if (!liveSheet) liveSheet = ss.getSheets()[0];

    const matrixToAppend = [];
    newRows.forEach(function(r) {
      const cleanDate = formatToFrenchDateString(r.date || "");
      if (r.note || r.hMatin || r.hSoir) {
        matrixToAppend.push([cleanDate, r.matin || "", r.soir || "", r.note || "", r.hMatin || "", r.hSoir || ""]);
      } else {
        matrixToAppend.push([cleanDate, r.matin || "", r.soir || ""]);
      }
    });

    function appendChronologicalPlanning(targetSheet, sourceHistorySheet, rowsMatrix) {
      if (!rowsMatrix || rowsMatrix.length === 0) return;

      let existingData = targetSheet.getDataRange().getValues();
      while (existingData.length > 0 && existingData[existingData.length - 1].every(function(c) { return String(c).trim() === ""; })) {
        existingData.pop();
      }

      for (let i = 0; i < existingData.length; i++) {
        if (existingData[i][0]) existingData[i][0] = formatToFrenchDateString(existingData[i][0]);
      }

      if (existingData.length <= 1 && sourceHistorySheet && sourceHistorySheet !== targetSheet) {
        let historyData = sourceHistorySheet.getDataRange().getValues();
        while (historyData.length > 0 && historyData[historyData.length - 1].every(function(c) { return String(c).trim() === ""; })) {
          historyData.pop();
        }
        for (let i = 0; i < historyData.length; i++) {
          if (historyData[i][0]) historyData[i][0] = formatToFrenchDateString(historyData[i][0]);
        }
        if (historyData.length > 0) existingData = historyData;
      }

      const firstNewDate = String(rowsMatrix.find(function(r) { return r[0] && String(r[0]).toUpperCase().indexOf("DATE") === -1; })?.[0] || "").toLowerCase().trim();
      let duplicateIndex = -1;

      if (firstNewDate) {
        for (let i = 0; i < existingData.length; i++) {
          const rowDate = String(existingData[i][0] || "").toLowerCase().trim();
          if (rowDate === firstNewDate) {
            duplicateIndex = (i > 0 && String(existingData[i-1][0]).toUpperCase().indexOf("DATE") !== -1) ? i - 1 : i;
            break;
          }
        }
      }

      let combinedData = (duplicateIndex !== -1) ? existingData.slice(0, duplicateIndex) : existingData.slice();
      if (combinedData.length > 0) combinedData.push(["", "", ""]);
      rowsMatrix.forEach(function(row) { combinedData.push(row); });

      targetSheet.clear();
      const numCols = Math.max.apply(null, combinedData.map(function(row) { return row.length; })) || 3;
      const paddedMatrix = combinedData.map(function(row) {
        const newRow = row.slice();
        while (newRow.length < numCols) newRow.push("");
        return newRow;
      });

      const range = targetSheet.getRange(1, 1, paddedMatrix.length, numCols);
      range.setValues(paddedMatrix);
      targetSheet.getRange(1, 1, paddedMatrix.length, 1).setNumberFormat("@");
      targetSheet.setColumnWidth(1, 140);
      targetSheet.setColumnWidth(2, 420);
      targetSheet.setColumnWidth(3, 420);
      if (numCols >= 4) targetSheet.setColumnWidth(4, 200);

      range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
      range.setVerticalAlignment("middle");
      range.setFontFamily("Arial");
      range.setFontSize(10);

      for (let i = 0; i < paddedMatrix.length; i++) {
        if (String(paddedMatrix[i][0]).toUpperCase().indexOf("DATE") !== -1) {
          targetSheet.getRange(i + 1, 1, 1, numCols).setFontWeight("bold");
        }
      }
    }

    if (action === "save_draft") {
      appendChronologicalPlanning(draftSheet, liveSheet, matrixToAppend);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        stage: "draft",
        message: "Nouveau planning ajouté chronologiquement dans l'onglet BROUILLON",
        count: matrixToAppend.length
      })).setMimeType(ContentService.MimeType.JSON);
    } 
    else if (action === "publish_live" || action === "publish_draft_direct") {
      if (matrixToAppend && matrixToAppend.length > 0) {
        appendChronologicalPlanning(liveSheet, null, matrixToAppend);
        appendChronologicalPlanning(draftSheet, null, matrixToAppend);
      } else {
        var draftData = draftSheet.getDataRange().getValues();
        while (draftData.length > 0 && draftData[draftData.length - 1].every(function(c) { return String(c).trim() === ""; })) {
          draftData.pop();
        }
        if (draftData.length === 0) {
          return ContentService.createTextOutput(JSON.stringify({
            status: "error",
            message: "Le brouillon est vide. Impossible de diffuser."
          })).setMimeType(ContentService.MimeType.JSON);
        }
        liveSheet.clear();
        var numCols = Math.max.apply(null, draftData.map(function(r) { return r.length; })) || 3;
        var padded = draftData.map(function(row) {
          var nr = row.slice();
          while (nr.length < numCols) nr.push("");
          return nr;
        });
        var range = liveSheet.getRange(1, 1, padded.length, numCols);
        range.setValues(padded);
        liveSheet.getRange(1, 1, padded.length, 1).setNumberFormat("@");
        liveSheet.setColumnWidth(1, 140);
        liveSheet.setColumnWidth(2, 420);
        liveSheet.setColumnWidth(3, 420);
        if (numCols >= 4) liveSheet.setColumnWidth(4, 200);
        range.setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
        range.setVerticalAlignment("middle");
        range.setFontFamily("Arial");
        range.setFontSize(10);

        for (var i = 0; i < padded.length; i++) {
          if (String(padded[i][0]).toUpperCase().indexOf("DATE") !== -1) {
            liveSheet.getRange(i + 1, 1, 1, numCols).setFontWeight("bold");
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        stage: "published",
        message: "Nouveau planning diffusé dans Feuille 1",
        count: matrixToAppend.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Action inconnue" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const type = (e && e.parameter && e.parameter.type) || "draft";

    if (type === "cuisine") {
      var cSheet = ss.getSheetByName("CUISINE");
      if (!cSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", type: "cuisine", data: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var cVals = cSheet.getDataRange().getValues();
      var dayMap = {};
      var dayOrder = [];
      for (var i = 1; i < cVals.length; i++) {
        var dName = String(cVals[i][0] || "").trim();
        var mName = String(cVals[i][1] || "").trim();
        var gender = String(cVals[i][2] || "homme").trim();
        var badge = String(cVals[i][3] || "").trim();
        if (!dName || !mName) continue;
        if (!dayMap[dName]) {
          dayMap[dName] = { dayName: dName, staff: [] };
          dayOrder.push(dayMap[dName]);
        }
        dayMap[dName].staff.push({ name: mName, gender: gender, badge: badge });
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", type: "cuisine", data: dayOrder }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (type === "menage") {
      var mSheet = ss.getSheetByName("MENAGE");
      if (!mSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", type: "menage", data: null }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var mVals = mSheet.getDataRange().getValues();
      var res = { S1: { title: "Semaine 01", schedules: [] }, S2: { title: "Semaine 02", schedules: [] } };
      for (var j = 1; j < mVals.length; j++) {
        var wk = String(mVals[j][0] || "").trim();
        var day = String(mVals[j][1] || "").trim().toLowerCase();
        var matinStaff = String(mVals[j][2] || "").trim();
        var soirStaff = String(mVals[j][3] || "").trim();
        if ((wk === "S1" || wk === "S2") && day) {
          res[wk].schedules.push({ day: day, matin: { staff: matinStaff }, soir: { staff: soirStaff } });
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", type: "menage", data: res }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = (type === "live") 
      ? (ss.getSheetByName("PUBLIE") || ss.getSheetByName("Feuille 1") || ss.getSheets()[0])
      : (ss.getSheetByName("BROUILLON") || ss.getSheetByName("PUBLIE") || ss.getSheets()[0]);
    
    const data = sheet.getDataRange().getValues();
    const rows = [];
    for (let i = 0; i < data.length; i++) {
      if (data[i][0]) {
        const cleanDate = formatToFrenchDateString(data[i][0]);
        rows.push({
          date: cleanDate,
          matin: String(data[i][1] || ""),
          soir: String(data[i][2] || ""),
          note: String(data[i][3] || ""),
          hMatin: String(data[i][4] || ""),
          hSoir: String(data[i][5] || "")
        });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: "success", type: type, rows: rows }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  /* ════════════════════════════════════════════════════════════════════
     4. DÉTECTION, VALIDATION & PUBLICATION FIABILISÉE (CONFIRMATION CORS)
     ════════════════════════════════════════════════════════════════════ */
  let isSyncInFlight = false;
  let lastPublishedSignature = "";
  let lastPublishedAt = 0;

  function validatePlanningRows(rowsData) {
    if (!Array.isArray(rowsData) || rowsData.length === 0) {
      return { valid: false, error: "Le planning est vide. Veuillez d'abord générer des données.", dayCount: 0 };
    }
    const dayRows = rowsData.filter(r => r && !String(r.date || "").trim().toUpperCase().startsWith("DATE"));
    if (dayRows.length === 0) {
      return { valid: false, error: "Le planning ne contient aucune journée active (hors en-tête DATE).", dayCount: 0 };
    }
    for (let i = 0; i < dayRows.length; i++) {
      const r = dayRows[i];
      const dateStr = String(r.date || "").trim();
      const matinStr = String(r.matin || "").trim();
      const soirStr = String(r.soir || "").trim();
      if (!dateStr) {
        return { valid: false, error: `Ligne ${i + 1} : date manquante.`, dayCount: dayRows.length };
      }
      if (!matinStr && !soirStr) {
        return { valid: false, error: `Jour "${dateStr}" : les services Matin et Soir sont tous les deux vides.`, dayCount: dayRows.length };
      }
    }
    return { valid: true, error: "", dayCount: dayRows.length };
  }

  async function postToGoogleSheetsWebhook(webhookUrl, payload) {
    if (!webhookUrl) {
      throw new Error("URL Webhook Google Apps Script manquante.");
    }
    const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
    try {
      const resp = await fetch(webhookUrl, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      if (!resp.ok) {
        throw new Error(`Erreur serveur HTTP ${resp.status}`);
      }
      const rawText = await resp.text();
      if (GC.isHtml(rawText)) {
        throw new Error("Le Webhook a renvoyé une page HTML (vérifiez que l'accès Web App est configuré sur 'Tout le monde').");
      }
      let json;
      try {
        json = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error("Réponse non-JSON reçue depuis Google Apps Script.");
      }
      if (!json || json.status !== "success") {
        throw new Error((json && json.message) || "Échec confirmé par le serveur Google Sheets.");
      }
      return json;
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new Error("Délai d'attente dépassé (15s) lors de la communication avec Google Sheets.");
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function checkForPendingDraft() {
    const card = document.getElementById("draftPendingCard");
    const details = document.getElementById("draftPendingDetails");
    if (!card) return;

    const localDraft = localStorage.getItem("gc_draft_cache");
    if (localDraft) {
      try {
        const parsed = JSON.parse(localDraft);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const daysCount = parsed.filter(r => !r.isHeader && !String(r.date).toUpperCase().includes("DATE")).length;
          card.style.display = "flex";
          if (details) details.textContent = `Planning de ${daysCount} jour(s) détecté en attente dans le brouillon.`;
        }
      } catch (e) {}
    }

    const webhookUrl = GC.getWebhookUrl();
    if (webhookUrl) {
      try {
        const resp = await fetch(`${webhookUrl}?type=draft&t=${Date.now()}`, { redirect: "follow" });
        const json = await resp.json();
        if (json && json.status === "success" && Array.isArray(json.rows) && json.rows.length) {
          card.style.display = "flex";
          const daysCount = json.rows.filter(r => !r.isHeader && !String(r.date).toUpperCase().includes("DATE")).length;
          if (details) details.textContent = `Brouillon Google Sheets détecté (${daysCount} jour(s) prêt(s) à être diffusé(s)).`;
          localStorage.setItem("gc_draft_cache", JSON.stringify(json.rows));
        }
      } catch (e) {}
    }
  }

  async function publishDraftDirectly() {
    if (isSyncInFlight) {
      GC.showToast("⏳ Une publication est déjà en cours...");
      return;
    }
    if (!GC.isSessionAuth("gc_service_admin", "admin")) {
      alert("Session administrateur expirée. Veuillez vous reconnecter.");
      logoutServiceAdmin();
      return;
    }

    const webhookUrl = GC.getWebhookUrl();
    if (!webhookUrl) {
      const body = document.getElementById("syncConfigBody");
      if (body) body.style.display = "flex";
      alert("Veuillez configurer l'URL du Webhook Google Apps Script avant de diffuser le brouillon.");
      document.getElementById("cfg_webhook_url")?.focus();
      return;
    }

    const localDraft = localStorage.getItem("gc_draft_cache");
    let rowsToPublish = null;
    if (localDraft) {
      try { rowsToPublish = JSON.parse(localDraft); } catch (e) {}
    }

    if (Array.isArray(rowsToPublish) && rowsToPublish.length > 0) {
      const validation = validatePlanningRows(rowsToPublish);
      if (!validation.valid) {
        alert("Brouillon incohérent : " + validation.error);
        return;
      }
      const sig = JSON.stringify(rowsToPublish);
      if (sig === lastPublishedSignature && (Date.now() - lastPublishedAt) < 10000) {
        GC.showToast("ℹ️ Ce brouillon vient déjà d'être diffusé.");
        return;
      }
    }

    const confirmPublish = confirm(
      "⚠️ FEU VERT ADMIN :\n\n" +
      "Voulez-vous diffuser officiellement le planning actuellement dans l'onglet BROUILLON à toute l'équipe ?\n\n" +
      "• Il sera visible immédiatement sur l'application vestiaires.\n" +
      "• L'onglet public Google Sheets (Feuille 1 / PUBLIE) sera mis à jour."
    );
    if (!confirmPublish) return;

    const btn = document.getElementById("btnPublishDirect");
    const origText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.classList.add("btn-disabled");
      btn.innerHTML = "⏳ Diffusion en cours...";
    }

    isSyncInFlight = true;
    try {
      const payload = {
        action: "publish_draft_direct",
        authHash: GC.getAdminAuthToken(),
        rows: rowsToPublish || []
      };
      const result = await postToGoogleSheetsWebhook(webhookUrl, payload);

      if (rowsToPublish && rowsToPublish.length) {
        lastPublishedSignature = JSON.stringify(rowsToPublish);
        lastPublishedAt = Date.now();
        localStorage.setItem("gc_live_cache", JSON.stringify(rowsToPublish));
        const cleanData = rowsToPublish.filter(r => !String(r.date).toUpperCase().includes("DATE")).map(r => ({
          date: r.date,
          dateObj: GC.parseDateLabel(r.date),
          matin: r.matin,
          soir: r.soir,
          hMatin: r.hMatin,
          hSoir: r.hSoir
        }));
        if (typeof window.renderPlanningFromData === "function") {
          window.renderPlanningFromData(cleanData);
        }
      }

      const card = document.getElementById("draftPendingCard");
      if (card) card.style.display = "none";

      closeGeneratorModal();
      GC.showToast(`🚀 ${result.message || "Feu Vert Accordé ! Brouillon diffusé à toute l'équipe."}`);
    } catch (err) {
      console.error("Erreur diffusion directe brouillon:", err);
      GC.showToast("❌ Échec de diffusion. Le brouillon est conservé.");
      alert("❌ Échec de la diffusion vers Google Sheets :\n" + (err.message || err) + "\n\nLe brouillon a été conservé sans modification.");
    } finally {
      isSyncInFlight = false;
      if (btn) {
        btn.classList.remove("btn-disabled");
        btn.innerHTML = origText;
      }
    }
  }

  function initAppsScriptPreview() {
    const el = document.getElementById("appsScriptCodePreview");
    if (el) el.textContent = APPS_SCRIPT_CODE;
  }

  function toggleSyncConfig() {
    const body = document.getElementById("syncConfigBody");
    const toggle = document.getElementById("syncConfigToggle");
    if (!body) return;
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "flex";
    if (toggle) toggle.textContent = isOpen ? "Configurer le Webhook ▼" : "Fermer ▲";
  }

  function loadWebhookUrl() {
    const url = GC.getWebhookUrl();
    const input = document.getElementById("cfg_webhook_url");
    if (input) input.value = url;
  }

  function saveWebhookUrl() {
    const input = document.getElementById("cfg_webhook_url");
    if (!input) return;
    const url = input.value.trim();
    localStorage.setItem("gc_webhook_url", url);
    GC.showToast("💾 URL Webhook enregistrée !");
  }

  function copyAppsScriptCode() {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE).then(() => {
      GC.showToast("📋 Code Google Apps Script copié dans le presse-papier !");
    }).catch(() => {
      alert("Veuillez sélectionner le code manuellement et faire Ctrl+C.");
    });
  }

  function updateSyncStatus(stage, customMsg) {
    const badge = document.getElementById("syncStatusBadge");
    const msg = document.getElementById("syncStatusMsg");
    if (!badge) return;

    if (stage === "draft") {
      badge.className = "status-tag draft";
      badge.innerHTML = "🟡 Brouillon enregistré (Non diffusé)";
      if (msg) msg.textContent = customMsg || "Sauvegardé dans l'onglet BROUILLON de Google Sheets.";
    } else if (stage === "published") {
      badge.className = "status-tag published";
      badge.innerHTML = "🟢 Diffusé et en ligne";
      if (msg) msg.textContent = customMsg || "En ligne sur Google Sheets & visible par l'équipe.";
    } else if (stage === "error") {
      badge.className = "status-tag error";
      badge.innerHTML = "🔴 Échec de synchronisation";
      if (msg) msg.textContent = customMsg || "Erreur serveur ou réseau. Brouillon sauvegardé localement.";
    } else {
      badge.className = "status-tag editing";
      badge.innerHTML = "✍️ En cours de modification";
      if (msg) msg.textContent = customMsg || "Modifications non sauvegardées dans le Cloud.";
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     5. ENREGISTREMENT GOOGLE SHEETS & CHARGEMENT (AVEC CONFIRMATION RÉELLE)
     ════════════════════════════════════════════════════════════════════ */
  async function saveToGoogleSheets(isPublishLive) {
    if (isSyncInFlight) {
      GC.showToast("⏳ Une opération Cloud est déjà en cours...");
      return;
    }
    if (!GC.isSessionAuth("gc_service_admin", "admin")) {
      alert("Session administrateur expirée. Veuillez vous reconnecter.");
      logoutServiceAdmin();
      return;
    }

    const webhookUrl = GC.getWebhookUrl();
    const rowsData = extractTableData();

    const validation = validatePlanningRows(rowsData);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    if (!webhookUrl) {
      const body = document.getElementById("syncConfigBody");
      if (body) body.style.display = "flex";
      alert("Veuillez configurer l'URL de votre Webhook Google Apps Script ci-dessus pour activer la persistance automatique.");
      document.getElementById("cfg_webhook_url")?.focus();
      return;
    }

    const sig = JSON.stringify(rowsData);
    if (isPublishLive && sig === lastPublishedSignature && (Date.now() - lastPublishedAt) < 10000) {
      GC.showToast("ℹ️ Ce planning vient déjà d'être publié à l'instant.");
      return;
    }

    if (isPublishLive) {
      const confirmPublish = confirm(
        "⚠️ FEU VERT ADMIN :\n\n" +
        "Voulez-vous officiellement DIFFUSER ce nouveau planning à toute l'équipe ?\n\n" +
        "• Il sera visible immédiatement sur l'application vestiaires.\n" +
        "• L'onglet public Google Sheets sera mis à jour."
      );
      if (!confirmPublish) return;
    }

    const btnSaveDraft = document.getElementById("btnSaveDraft");
    const btnPublishLive = document.getElementById("btnPublishLive");

    const origDraftText = btnSaveDraft ? btnSaveDraft.innerHTML : "";
    const origPubText = btnPublishLive ? btnPublishLive.innerHTML : "";

    if (btnSaveDraft) btnSaveDraft.classList.add("btn-disabled");
    if (btnPublishLive) btnPublishLive.classList.add("btn-disabled");

    if (isPublishLive && btnPublishLive) btnPublishLive.innerHTML = "⏳ Diffusion en cours...";
    else if (!isPublishLive && btnSaveDraft) btnSaveDraft.innerHTML = "⏳ Sauvegarde brouillon...";

    const payload = {
      action: isPublishLive ? "publish_live" : "save_draft",
      authHash: GC.getAdminAuthToken(),
      rows: rowsData
    };

    isSyncInFlight = true;
    try {
      const result = await postToGoogleSheetsWebhook(webhookUrl, payload);

      localStorage.setItem("gc_draft_cache", sig);

      if (!isPublishLive) {
        updateSyncStatus("draft", result.message || "Brouillon confirmé dans Google Sheets sans diffusion.");
        GC.showToast("🟡 Brouillon confirmé dans Google Sheets (Onglet BROUILLON).");
      } else {
        lastPublishedSignature = sig;
        lastPublishedAt = Date.now();
        localStorage.setItem("gc_live_cache", sig);
        updateSyncStatus("published", result.message || "Planning officiellement publié et confirmé.");
        GC.showToast("🚀 Feu Vert Confirmé ! Planning diffusé dans Google Sheets.");
        applyGeneratedToLiveView();
      }
    } catch (err) {
      console.error("Erreur sync Google Sheets:", err);
      localStorage.setItem("gc_draft_cache", sig);
      updateSyncStatus("error", `Échec Cloud (${err.message || "réseau"}). Brouillon conservé en local.`);
      GC.showToast("❌ Échec Cloud — Brouillon conservé en local.");
      alert("❌ La publication vers Google Sheets a échoué :\n" + (err.message || err) + "\n\nVos données ont été conservées localement en brouillon.");
    } finally {
      isSyncInFlight = false;
      if (btnSaveDraft) {
        btnSaveDraft.classList.remove("btn-disabled");
        btnSaveDraft.innerHTML = origDraftText;
      }
      if (btnPublishLive) {
        btnPublishLive.classList.remove("btn-disabled");
        btnPublishLive.innerHTML = origPubText;
      }
    }
  }

  async function loadDraftData() {
    const webhookUrl = GC.getWebhookUrl();
    let draftRows = null;
    GC.showToast("⏳ Chargement du brouillon...");

    if (webhookUrl) {
      try {
        const resp = await fetch(`${webhookUrl}?type=draft&t=${Date.now()}`);
        const json = await resp.json();
        if (json && json.status === "success" && Array.isArray(json.rows) && json.rows.length) {
          draftRows = json.rows;
        }
      } catch (e) {}
    }

    if (!draftRows) {
      try {
        const localDraft = localStorage.getItem("gc_draft_cache");
        if (localDraft) draftRows = JSON.parse(localDraft);
      } catch (e) {}
    }

    if (draftRows && draftRows.length) {
      renderEditableTable(draftRows);
      updateSyncStatus("draft", "Dernier brouillon chargé avec succès.");
      GC.showToast("📥 Brouillon chargé dans l'éditeur.");
    } else {
      alert("Aucun brouillon trouvé. Générez d'abord un planning ou enregistrez un brouillon.");
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     6. GESTION DE L'ÉQUIPE (5 SERVEURS — BASSE SAISON) & PERSONNALISATION
     ════════════════════════════════════════════════════════════════════ */
  const DEFAULT_STAFF = ["youness", "aziz", "youssef", "zakaria", "mohamed"];
  let STAFF = [...DEFAULT_STAFF];

  function toggleTeamConfig() {
    const body = document.getElementById("teamConfigBody");
    const toggle = document.getElementById("teamConfigToggle");
    if (!body) return;
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "grid";
    if (toggle) toggle.textContent = isOpen ? "Personnaliser les 5 noms ▼" : "Fermer ▲";
  }

  function loadTeamNames() {
    try {
      const stored = localStorage.getItem("gc_service_team_5");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 5) {
          STAFF = parsed.map((n, i) => String(n || DEFAULT_STAFF[i]).trim().toLowerCase() || DEFAULT_STAFF[i]);
        }
      }
    } catch (e) {}

    for (let i = 0; i < 5; i++) {
      const el = document.getElementById(`cfg_s_${i}`);
      if (el) el.value = STAFF[i];
    }
    updateTeamLabelsAndBadges();
  }

  function saveTeamNames() {
    STAFF = DEFAULT_STAFF.map((defName, i) => {
      const val = document.getElementById(`cfg_s_${i}`)?.value.trim().toLowerCase();
      return val || defName;
    });
    try {
      localStorage.setItem("gc_service_team_5", JSON.stringify(STAFF));
    } catch (e) {}
    updateTeamLabelsAndBadges();
    renderServiceMetrics();
  }

  function capName(name) {
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
  }

  function updateTeamLabelsAndBadges() {
    for (let rot = 0; rot < 5; rot++) {
      const opt = document.getElementById(`opt_rot_${rot}`);
      if (opt) {
        const p = [0, 1, 2, 3, 4].map(i => STAFF[(i + rot) % 5]);
        opt.textContent = `Rotation ${rot + 1} — Repos Lun : ${capName(p[4])} | Matin : ${capName(p[0])} & ${capName(p[1])} | Soir : ${capName(p[2])} & ${capName(p[3])}`;
      }
    }

    const container = document.getElementById("quickBadgesContainer");
    if (container) {
      let html = "";
      STAFF.forEach((name, idx) => {
        const cap = capName(name);
        const cls = idx < 2 ? "g1" : "g2";
        html += `<button class="name-chip ${cls}" type="button" onclick="insertNameBadge('${GC.escapeHtml(name)}')">+ ${GC.escapeHtml(cap)}</button>`;
      });
      html += `<button class="name-chip special" type="button" onclick="insertNameBadge('— Repos —')">+ Repos</button>`;
      container.innerHTML = html;
    }

    const nameOptionsHtml = STAFF.map(n => `<option value="${GC.escapeHtml(n)}">${GC.escapeHtml(capName(n))}</option>`).join("");

    const repSelect = document.getElementById("repOldName");
    if (repSelect) repSelect.innerHTML = nameOptionsHtml;
    const leaveStaffSelect = document.getElementById("leaveStaffSelect");
    if (leaveStaffSelect) leaveStaffSelect.innerHTML = nameOptionsHtml;
    const leaveRepSelect = document.getElementById("leaveReplacementSelect");
    if (leaveRepSelect) leaveRepSelect.innerHTML = nameOptionsHtml;
  }

  let lastFocusedCell = null;
  document.addEventListener("focusin", (e) => {
    if (e.target && (e.target.classList.contains("cell-shift") || e.target.classList.contains("cell-date") || e.target.classList.contains("cell-note"))) {
      lastFocusedCell = e.target;
    }
  });

  function insertNameBadge(name) {
    if (lastFocusedCell && document.body.contains(lastFocusedCell)) {
      const start = lastFocusedCell.selectionStart || 0;
      const end = lastFocusedCell.selectionEnd || 0;
      const val = lastFocusedCell.value;
      const insertText = (start > 0 && val[start-1] !== ' ' && val[start-1] !== ',' ? ', ' : '') + name;
      lastFocusedCell.value = val.substring(0, start) + insertText + val.substring(end);
      lastFocusedCell.focus();
      const newPos = start + insertText.length;
      lastFocusedCell.setSelectionRange(newPos, newPos);
      GC.showToast(`🏷️ Inséré : ${name}`);
      updateSyncStatus("editing");
      renderServiceMetrics();
    } else {
      navigator.clipboard.writeText(name).then(() => {
        GC.showToast(`📋 Nom copié : ${name}`);
      });
    }
  }

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function replaceNameGlobally() {
    const oldName = document.getElementById("repOldName")?.value.trim().toLowerCase();
    const newName = document.getElementById("repNewName")?.value.trim().toLowerCase();
    if (!oldName || !newName) {
      alert("Veuillez choisir un nom existant et saisir le nouveau nom.");
      return;
    }
    const inputs = document.querySelectorAll("#editTableBody textarea, #editTableBody input");
    let count = 0;
    const regex = new RegExp(`\\b${escapeRegExp(oldName)}\\b`, "gi");
    inputs.forEach(input => {
      if (regex.test(input.value)) {
        regex.lastIndex = 0;
        input.value = input.value.replace(regex, newName);
        count++;
      }
    });
    GC.showToast(`✨ "${oldName}" remplacé par "${newName}" (${count} occurrences modifiées).`);
    document.getElementById("repNewName").value = "";
    updateSyncStatus("editing");
    renderServiceMetrics();
  }

  /* ════════════════════════════════════════════════════════════════════
     7. GESTION DES CONGÉS DATE À DATE
     ════════════════════════════════════════════════════════════════════ */
  function toggleLeaveActionInputs() {
    const action = document.getElementById("leaveActionType")?.value;
    const repField = document.getElementById("leaveReplacementField");
    if (repField) repField.style.display = (action === "replace") ? "inline-flex" : "none";
  }

  function applyLeavePeriod() {
    const staffName = document.getElementById("leaveStaffSelect")?.value.trim().toLowerCase();
    const startStr = document.getElementById("leaveDateStart")?.value;
    const endStr = document.getElementById("leaveDateEnd")?.value;
    const action = document.getElementById("leaveActionType")?.value;
    const replacementName = document.getElementById("leaveReplacementSelect")?.value.trim().toLowerCase();

    if (!staffName) { alert("Veuillez sélectionner un employé."); return; }
    if (!startStr || !endStr) { alert("Veuillez sélectionner la date de début et de fin."); return; }

    const [sy, sm, sd] = startStr.split("-").map(Number);
    const [ey, em, ed] = endStr.split("-").map(Number);
    const startDate = new Date(sy, sm - 1, sd); startDate.setHours(0,0,0,0);
    const endDate = new Date(ey, em - 1, ed); endDate.setHours(0,0,0,0);

    if (endDate < startDate) { alert("La date de fin doit être égale ou postérieure à la date de début."); return; }
    if (action === "replace" && staffName === replacementName) { alert("Veuillez choisir un remplaçant différent."); return; }

    const rows = Array.from(document.querySelectorAll("#editTableBody tr"));
    let affectedDays = 0;

    function processShift(shiftVal, name, act, repName) {
      if (!shiftVal || !shiftVal.trim() || shiftVal.includes("— Repos —")) return { val: shiftVal, changed: false };

      if (act === "replace") {
        const reg = new RegExp(`\\b${name}\\b`, "gi");
        if (reg.test(shiftVal)) {
          return { val: shiftVal.replace(reg, repName), changed: true };
        }
        return { val: shiftVal, changed: false };
      }

      if (act === "remove" || act === "repos") {
        const segments = shiftVal.split(",").map(s => s.trim()).filter(Boolean);
        const reg = new RegExp(`\\b${name}\\b`, "i");
        let hadMatch = false;
        const filtered = segments.filter(s => {
          if (reg.test(s)) { hadMatch = true; return false; }
          return true;
        });

        if (hadMatch) {
          return { val: (filtered.length === 0 ? "— Repos —" : filtered.join(", ")), changed: true };
        }
        return { val: shiftVal, changed: false };
      }

      return { val: shiftVal, changed: false };
    }

    rows.forEach(tr => {
      const dateInput = tr.querySelector(".cell-date");
      const shiftInputs = tr.querySelectorAll(".cell-shift");
      if (!dateInput || shiftInputs.length < 2) return;

      const rowDateObj = GC.parseDateLabel(dateInput.value);
      if (rowDateObj && rowDateObj >= startDate && rowDateObj <= endDate) {
        let rowChanged = false;
        const resMatin = processShift(shiftInputs[0].value, staffName, action, replacementName);
        if (resMatin.changed) { shiftInputs[0].value = resMatin.val; rowChanged = true; }

        const resSoir = processShift(shiftInputs[1].value, staffName, action, replacementName);
        if (resSoir.changed) { shiftInputs[1].value = resSoir.val; rowChanged = true; }

        if (rowChanged) affectedDays++;
      }
    });

    if (affectedDays > 0) {
      const staffCap = staffName.charAt(0).toUpperCase() + staffName.slice(1);
      let msg = `🏖️ Congé appliqué : ${staffCap} retiré sur ${affectedDays} jour(s) du ${startStr} au ${endStr}.`;
      if (action === "replace") {
        const repCap = replacementName.charAt(0).toUpperCase() + replacementName.slice(1);
        msg = `🔄 Remplacement de ${staffCap} par ${repCap} appliqué sur ${affectedDays} jour(s).`;
      }
      GC.showToast(msg);
      updateSyncStatus("editing");
      renderServiceMetrics();
    } else {
      alert(`Aucune affectation trouvée pour "${staffName}" sur la période sélectionnée.`);
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     8. MOTEUR DE ROTATION CARRÉE (5 SERVEURS) & TABLEAU ÉDITABLE
     ════════════════════════════════════════════════════════════════════ */
  function formatWeekdayPair(carreA, carreB) {
    return `${carreA} (SAL1), ${carreA} (TER2), ${carreB} (TER1), ${carreB} (SAL2), ${carreB} (LOG)`;
  }

  function generatePlanningData() {
    const startStr = document.getElementById("genStartDate").value;
    if (!startStr) { alert("Veuillez sélectionner une date de départ."); return; }

    const startRotation = parseInt(document.getElementById("genStartGroup").value, 10) || 0;
    const weeksCount = parseInt(document.getElementById("genWeeksCount").value, 10) || 1;
    const alertMsg   = document.getElementById("genAlertMsg").value.trim();

    const [sy, sm, sd] = startStr.split("-").map(Number);
    let currDate = new Date(sy, sm - 1, sd);
    const generatedRows = [];

    for (let w = 0; w < weeksCount; w++) {
      const offset = (startRotation + w) % 5;
      const P = [0, 1, 2, 3, 4].map(i => STAFF[(i + offset) % 5]);

      generatedRows.push({
        isHeader: true,
        date: "DATE",
        matin: "MATIN (06:30 - 14:30)",
        soir: "SOIR (14:15 - Fin)",
        note: (w === 0 && alertMsg) ? alertMsg : "",
        hMatin: "06:30-14:30",
        hSoir: "14:15- Fin service"
      });

      for (let d = 0; d < 7; d++) {
        const dateLabel = GC.formatFrenchDate(currDate);
        let matinStr = "", soirStr = "", noteStr = "";

        if (d === 0) {
          // Lundi (Repos: P[4]) — 2 Matin / 2 Soir
          matinStr = formatWeekdayPair(P[0], P[1]);
          soirStr  = formatWeekdayPair(P[2], P[3]);
        } else if (d === 1) {
          // Mardi (Repos: P[0]) — 24h: P[2],P[3] inversent leurs carrés au Matin
          matinStr = formatWeekdayPair(P[3], P[2]);
          soirStr  = formatWeekdayPair(P[1], P[4]);
        } else if (d === 2) {
          // Mercredi (Repos: P[2]) — 24h: P[1],P[4] inversent leurs carrés au Matin
          matinStr = formatWeekdayPair(P[4], P[1]);
          soirStr  = formatWeekdayPair(P[3], P[0]);
        } else if (d === 3) {
          // Jeudi (Repos: P[1]) — 24h: P[3],P[0] inversent leurs carrés au Matin
          matinStr = formatWeekdayPair(P[0], P[3]);
          soirStr  = formatWeekdayPair(P[4], P[2]);
        } else if (d === 4) {
          // Vendredi (Repos: P[3]) — 24h: P[4],P[2] inversent leurs carrés au Matin
          matinStr = formatWeekdayPair(P[2], P[4]);
          soirStr  = formatWeekdayPair(P[1], P[0]);
        } else if (d === 5) {
          // Samedi : 3 Matin / 3 Soir dont 1 Continu 10H (P[3])
          matinStr = `${P[0]} (SAL1), ${P[0]} (TER3), ${P[1]} (TER1), ${P[1]} (TER2), ${P[3]} (SAL2 - 10H), ${P[3]} (LOG - 10H)`;
          soirStr  = `${P[2]} (SAL1), ${P[2]} (TER3), ${P[4]} (SAL2), ${P[4]} (LOG), ${P[3]} (TER1 - 10H), ${P[3]} (TER2 - 10H)`;
        } else if (d === 6) {
          // Dimanche : 4 Matin (dont 1 DEB) / 3 Soir avec 2 Continus 10H (P[0], P[1])
          matinStr = `${P[2]} (SAL1), ${P[2]} (TER3), ${P[4]} (TER1), ${P[4]} (TER2), ${P[0]} (SAL2 - 10H), ${P[0]} (LOG - 10H), ${P[1]} (DEB - 10H)`;
          soirStr  = `${P[3]} (SAL1), ${P[3]} (TER3), ${P[0]} (TER1 - 10H), ${P[0]} (TER2 - 10H), ${P[1]} (SAL2 - 10H), ${P[1]} (LOG - 10H)`;
        }

        generatedRows.push({
          isHeader: false,
          date: dateLabel,
          matin: matinStr,
          soir: soirStr,
          note: noteStr,
          hMatin: "06:30-14:30",
          hSoir: "14:15- Fin service"
        });
        currDate.setDate(currDate.getDate() + 1);
      }
    }

    renderEditableTable(generatedRows);
    updateSyncStatus("editing");
  }

  function onTableCellEdit() {
    updateSyncStatus("editing");
    renderServiceMetrics();
  }

  function deleteTableRow(btn) {
    const tr = btn?.closest("tr");
    if (tr) tr.remove();
    updateSyncStatus("editing");
    renderServiceMetrics();
  }

  function extractShiftEntries(shiftStr) {
    if (!shiftStr || shiftStr === "-" || shiftStr.includes("— Repos —")) return [];
    const entries = [];
    shiftStr.split(",").forEach(seg => {
      const s = seg.trim();
      if (!s) return;
      let nom = "", poste = "";
      if (s.includes(":")) {
        const p = s.split(":");
        poste = p[0].trim();
        nom = p.slice(1).join(":").trim();
      } else if (s.includes("(") && s.includes(")")) {
        nom = s.substring(0, s.indexOf("(")).trim();
        poste = s.substring(s.indexOf("(") + 1, s.lastIndexOf(")")).trim();
      } else {
        nom = s;
      }
      if (nom) entries.push({ name: nom.toLowerCase(), is10h: /10\s*h|coup|contin/i.test(poste) });
    });
    return entries;
  }

  function renderServiceMetrics() {
    const container = document.getElementById("serviceMetricsSummary");
    if (!container) return;

    const rows = extractTableData().filter(r => r.date && !r.date.toUpperCase().includes("DATE"));
    if (!rows.length) {
      container.innerHTML = "";
      return;
    }

    const stats = {};
    STAFF.forEach(n => {
      stats[n.toLowerCase()] = { label: capName(n), matin: 0, soir: 0, coupure: 0, repos: 0 };
    });

    rows.forEach(r => {
      const mEntries = extractShiftEntries(r.matin);
      const sEntries = extractShiftEntries(r.soir);
      const mSet = new Set(mEntries.map(e => e.name));
      const sSet = new Set(sEntries.map(e => e.name));

      Object.keys(stats).forEach(low => {
        const inM = mSet.has(low);
        const inS = sSet.has(low);
        const has10h = mEntries.some(e => e.name === low && e.is10h) || sEntries.some(e => e.name === low && e.is10h);
        if (inM) stats[low].matin++;
        if (inS) stats[low].soir++;
        if ((inM && inS) || has10h) stats[low].coupure++;
        if (!inM && !inS) stats[low].repos++;
      });
    });

    container.innerHTML = Object.values(stats).map(st => `
      <div class="service-metric-card">
        <div class="service-metric-name">${GC.escapeHtml(st.label)}</div>
        <div class="service-metric-stats">
          Matin: <strong>${st.matin}</strong> · Soir: <strong>${st.soir}</strong><br/>
          <span class="service-metric-coupure service-metric-continu">Continu 10H: ${st.coupure}</span> · Repos: <strong>${st.repos}</strong>
        </div>
      </div>
    `).join("");
  }

  function renderEditableTable(rows) {
    const tbody = document.getElementById("editTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    rows.forEach((r) => {
      const tr = document.createElement("tr");
      if (r.isHeader) {
        tr.style.background = "var(--paper)";
        tr.style.fontWeight = "bold";
      }

      tr.innerHTML = `
        <td><input type="text" class="cell-date" value="${GC.escapeHtml(r.date)}" oninput="onTableCellEdit()" /></td>
        <td><textarea rows="2" class="cell-shift" oninput="onTableCellEdit()">${GC.escapeHtml(r.matin)}</textarea></td>
        <td><textarea rows="2" class="cell-shift" oninput="onTableCellEdit()">${GC.escapeHtml(r.soir)}</textarea></td>
        <td><input type="text" class="cell-note" value="${GC.escapeHtml(r.note)}" placeholder="Note/Alerte..." oninput="onTableCellEdit()" /></td>
        <td><input type="text" class="cell-time" value="${GC.escapeHtml(r.hMatin)}" oninput="onTableCellEdit()" /></td>
        <td><input type="text" class="cell-time" value="${GC.escapeHtml(r.hSoir)}" oninput="onTableCellEdit()" /></td>
        <td><button class="btn-del-row" onclick="deleteTableRow(this)" title="Supprimer">✕</button></td>
      `;
      tbody.appendChild(tr);
    });

    const previewSec = document.getElementById("previewSection");
    if (previewSec) previewSec.style.display = "flex";

    const startInput = document.getElementById("genStartDate");
    if (startInput && startInput.value) {
      const leaveStart = document.getElementById("leaveDateStart");
      const leaveEnd = document.getElementById("leaveDateEnd");
      if (leaveStart && !leaveStart.value) leaveStart.value = startInput.value;
      if (leaveEnd && !leaveEnd.value) {
        const [sy, sm, sd] = startInput.value.split("-").map(Number);
        const endD = new Date(sy, sm - 1, sd + 6);
        const ey = endD.getFullYear();
        const em = String(endD.getMonth() + 1).padStart(2, '0');
        const ed = String(endD.getDate()).padStart(2, '0');
        leaveEnd.value = `${ey}-${em}-${ed}`;
      }
    }

    renderServiceMetrics();
    GC.showToast("✨ Planning généré avec rotation carrée (5 serveurs) !");
  }

  function addNewDayRow() {
    const tbody = document.getElementById("editTableBody");
    if (!tbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" class="cell-date" value="lundi..." oninput="onTableCellEdit()" /></td>
      <td><textarea rows="2" class="cell-shift" oninput="onTableCellEdit()"></textarea></td>
      <td><textarea rows="2" class="cell-shift" oninput="onTableCellEdit()"></textarea></td>
      <td><input type="text" class="cell-note" value="" placeholder="Note/Alerte..." oninput="onTableCellEdit()" /></td>
      <td><input type="text" class="cell-time" value="06:30-14:30" oninput="onTableCellEdit()" /></td>
      <td><input type="text" class="cell-time" value="14:15- Fin service" oninput="onTableCellEdit()" /></td>
      <td><button class="btn-del-row" onclick="deleteTableRow(this)">✕</button></td>
    `;
    tbody.appendChild(tr);
    updateSyncStatus("editing");
    renderServiceMetrics();
  }

  function extractTableData() {
    const rows = Array.from(document.querySelectorAll("#editTableBody tr"));
    return rows.map(tr => {
      const inputs = tr.querySelectorAll("input, textarea");
      return {
        date: inputs[0]?.value.trim() ?? "",
        matin: inputs[1]?.value.trim() ?? "",
        soir: inputs[2]?.value.trim() ?? "",
        note: inputs[3]?.value.trim() ?? "",
        hMatin: inputs[4]?.value.trim() ?? "",
        hSoir: inputs[5]?.value.trim() ?? ""
      };
    }).filter(r => r.date || r.matin || r.soir);
  }

  function exportToGoogleSheetsClipboard() {
    const data = extractTableData();
    if (!data.length) { alert("Aucune donnée à copier."); return; }
    const tsvContent = data.map(r => [r.date, r.matin, r.soir, r.note, r.hMatin, r.hSoir].join("\t")).join("\n");

    navigator.clipboard.writeText(tsvContent).then(() => {
      GC.showToast("📋 Copié ! Allez dans Google Sheets (A1) et faites Ctrl+V.");
    }).catch(() => {
      alert("Impossible de copier automatiquement. Veuillez autoriser le presse-papier.");
    });
  }

  function downloadCsvFile() {
    const data = extractTableData();
    if (!data.length) { alert("Aucune donnée à exporter."); return; }

    const csvLines = data.map(r => {
      const escapeCsv = (val) => `"${String(val ?? '').replaceAll('"', '""')}"`;
      return [escapeCsv(r.date), escapeCsv(r.matin), escapeCsv(r.soir), escapeCsv(r.note), escapeCsv(r.hMatin), escapeCsv(r.hSoir)].join(",");
    });

    const csvContent = "\uFEFF" + csvLines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planning-service-rotation-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    GC.showToast("📥 Fichier CSV téléchargé avec succès.");
  }

  function applyGeneratedToLiveView() {
    const data = extractTableData();
    if (!data.length) { alert("Aucune donnée à afficher."); return; }

    const banner = data.find(r => r.note && r.note !== "-" && !r.note.toLowerCase().includes("notification"));
    if (banner) GC.showAlert(banner.note);
    else GC.hideAlert();

    const cleanData = data.filter(r => !r.date.toUpperCase().includes("DATE")).map(r => ({
      date: r.date,
      dateObj: GC.parseDateLabel(r.date),
      matin: r.matin,
      soir: r.soir,
      hMatin: r.hMatin,
      hSoir: r.hSoir
    }));

    if (typeof window.renderPlanningFromData === "function") {
      window.renderPlanningFromData(cleanData);
    }
    closeGeneratorModal();
  }

  // Exportation globale pour les gestionnaires d'événements HTML inline (onclick, etc.)
  window.openPinModal = openPinModal;
  window.closePinModal = closePinModal;
  window.clearAdminPin = clearAdminPin;
  window.submitAdminPin = submitAdminPin;
  window.logoutServiceAdmin = logoutServiceAdmin;
  window.openGeneratorDashboard = openGeneratorDashboard;
  window.closeGeneratorModal = closeGeneratorModal;
  window.validatePlanningRows = validatePlanningRows;
  window.postToGoogleSheetsWebhook = postToGoogleSheetsWebhook;
  window.checkForPendingDraft = checkForPendingDraft;
  window.publishDraftDirectly = publishDraftDirectly;
  window.initAppsScriptPreview = initAppsScriptPreview;
  window.toggleSyncConfig = toggleSyncConfig;
  window.loadWebhookUrl = loadWebhookUrl;
  window.saveWebhookUrl = saveWebhookUrl;
  window.copyAppsScriptCode = copyAppsScriptCode;
  window.updateSyncStatus = updateSyncStatus;
  window.saveToGoogleSheets = saveToGoogleSheets;
  window.loadDraftData = loadDraftData;
  window.toggleTeamConfig = toggleTeamConfig;
  window.loadTeamNames = loadTeamNames;
  window.saveTeamNames = saveTeamNames;
  window.insertNameBadge = insertNameBadge;
  window.replaceNameGlobally = replaceNameGlobally;
  window.toggleLeaveActionInputs = toggleLeaveActionInputs;
  window.applyLeavePeriod = applyLeavePeriod;
  window.generatePlanningData = generatePlanningData;
  window.renderEditableTable = renderEditableTable;
  window.renderServiceMetrics = renderServiceMetrics;
  window.onTableCellEdit = onTableCellEdit;
  window.deleteTableRow = deleteTableRow;
  window.addNewDayRow = addNewDayRow;
  window.extractTableData = extractTableData;
  window.exportToGoogleSheetsClipboard = exportToGoogleSheetsClipboard;
  window.downloadCsvFile = downloadCsvFile;
  window.applyGeneratedToLiveView = applyGeneratedToLiveView;

})(typeof window !== 'undefined' ? window : globalThis);
