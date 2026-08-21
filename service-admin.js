/**
 * GREY CORNER — Planning Service (Administration & Générateur)
 * Module extrait pour alléger service.html et optimiser les performances
 */
(function(window) {
  'use strict';

  /* ════════════════════════════════════════════════════════════════════
     1. GESTION DU CODE PIN ADMINISTRATEUR (1975)
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
    if (adminPinInput.length !== 4) {
      if (adminPinError) adminPinError.textContent = "Entrez le code à 4 chiffres.";
      return;
    }
    const isValid = await GC.verifyAdminPin(adminPinInput);
    if (isValid) {
      GC.setSessionAuth("gc_service_admin");
      closePinModal();
      openGeneratorDashboard();
    } else {
      if (adminPinError) adminPinError.textContent = "Code PIN Admin incorrect. Réessayez.";
      adminPinInput = "";
      updateAdminDots();
      if (pinBox) {
        pinBox.classList.remove("shake");
        void pinBox.offsetWidth;
        pinBox.classList.add("shake");
      }
    }
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
 * GREY CORNER — WEBHOOK PLANNING SERVICE
 * Workflow Chronologique : Ajout sous le dernier planning avec 1 ligne sautée
 * Formatage strict en français sans mention GMT/UTC dans la Colonne A
 */

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

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || "save_draft";
    const newRows = payload.rows || [];

    let draftSheet = ss.getSheetByName("BROUILLON");
    if (!draftSheet) draftSheet = ss.insertSheet("BROUILLON");

    let liveSheet = ss.getSheetByName("Feuille 1");
    if (!liveSheet) {
      const allSheets = ss.getSheets();
      for (let s = 0; s < allSheets.length; s++) {
        if (allSheets[s].getName() !== "BROUILLON") {
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
        if (draftData.length > 0) {
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
     4. DÉTECTION & DIFFUSION DIRECTE DU BROUILLON
     ════════════════════════════════════════════════════════════════════ */
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

    const webhookUrl = (localStorage.getItem("gc_webhook_url") || "").trim();
    if (webhookUrl) {
      try {
        const resp = await fetch(`${webhookUrl}?type=draft&t=${Date.now()}`);
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
    const webhookUrl = (localStorage.getItem("gc_webhook_url") || "").trim();
    const localDraft = localStorage.getItem("gc_draft_cache");

    let rowsToPublish = null;
    if (localDraft) {
      try { rowsToPublish = JSON.parse(localDraft); } catch (e) {}
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

    try {
      if (webhookUrl) {
        const payload = { action: "publish_draft_direct", rows: rowsToPublish || [] };
        await fetch(webhookUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload)
        });
      }

      if (rowsToPublish && rowsToPublish.length) {
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
      GC.showToast("🚀 Feu Vert Accordé ! Le brouillon a été officiellement diffusé à toute l'équipe.");
    } catch (err) {
      console.error("Erreur diffusion directe brouillon:", err);
      alert("Erreur lors de la diffusion. Vérifiez la connexion ou le Webhook.");
    } finally {
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
    const url = localStorage.getItem("gc_webhook_url") || "";
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
    } else {
      badge.className = "status-tag editing";
      badge.innerHTML = "✍️ En cours de modification";
      if (msg) msg.textContent = customMsg || "Modifications non sauvegardées dans le Cloud.";
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     5. ENREGISTREMENT GOOGLE SHEETS & CHARGEMENT
     ════════════════════════════════════════════════════════════════════ */
  async function saveToGoogleSheets(isPublishLive) {
    const webhookUrl = (localStorage.getItem("gc_webhook_url") || "").trim();
    const rowsData = extractTableData();

    if (!rowsData.length) {
      alert("Le planning est vide. Veuillez d'abord générer des données.");
      return;
    }

    if (!webhookUrl) {
      const body = document.getElementById("syncConfigBody");
      if (body) body.style.display = "flex";
      alert("Veuillez configurer l'URL de votre Webhook Google Apps Script ci-dessus pour activer la persistance automatique.");
      document.getElementById("cfg_webhook_url")?.focus();
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

    const payload = { action: isPublishLive ? "publish_live" : "save_draft", rows: rowsData };

    try {
      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });

      localStorage.setItem("gc_draft_cache", JSON.stringify(rowsData));

      if (!isPublishLive) {
        updateSyncStatus("draft", "Brouillon stocké dans Google Sheets sans diffusion.");
        GC.showToast("🟡 Brouillon enregistré dans Google Sheets (Onglet BROUILLON). Non visible par l'équipe.");
      } else {
        localStorage.setItem("gc_live_cache", JSON.stringify(rowsData));
        updateSyncStatus("published", "Planning officiellement publié et actif.");
        GC.showToast("🚀 Feu Vert Accordé ! Le planning est maintenant diffusé à l'équipe.");
        applyGeneratedToLiveView();
      }
    } catch (err) {
      console.error("Erreur sync Google Sheets:", err);
      localStorage.setItem("gc_draft_cache", JSON.stringify(rowsData));
      GC.showToast("⚠️ Enregistré en local. Vérifiez la connexion ou l'URL du Webhook.");
    } finally {
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
    const webhookUrl = (localStorage.getItem("gc_webhook_url") || "").trim();
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
     6. GESTION DES GROUPES & PERSONNALISATION D'ÉQUIPE
     ════════════════════════════════════════════════════════════════════ */
  let G1 = ["youness", "mokhtar", "aziz"];
  let G2 = ["youssef", "zakaria", "mohamed"];

  function toggleTeamConfig() {
    const body = document.getElementById("teamConfigBody");
    const toggle = document.getElementById("teamConfigToggle");
    if (!body) return;
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "grid";
    if (toggle) toggle.textContent = isOpen ? "Personnaliser les 6 noms ▼" : "Fermer ▲";
  }

  function toggleLeaveConfigCard() {
    const body = document.getElementById("leaveConfigCardBody");
    const toggle = document.getElementById("leaveConfigToggle");
    if (!body) return;
    const isOpen = body.style.display !== "none";
    body.style.display = isOpen ? "none" : "block";
    if (toggle) toggle.textContent = isOpen ? "Ouvrir l'outil Congés ▼" : "Fermer ▲";
  }

  function loadTeamNames() {
    try {
      const stored = localStorage.getItem("gc_team_names");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.g1) && parsed.g1.length === 3) G1 = parsed.g1;
        if (Array.isArray(parsed.g2) && parsed.g2.length === 3) G2 = parsed.g2;
      }
    } catch (e) {}

    for (let i = 0; i < 3; i++) {
      const el1 = document.getElementById(`cfg_g1_${i}`);
      if (el1) el1.value = G1[i];
      const el2 = document.getElementById(`cfg_g2_${i}`);
      if (el2) el2.value = G2[i];
    }
    updateTeamLabelsAndBadges();
  }

  function saveTeamNames() {
    G1 = [
      document.getElementById("cfg_g1_0")?.value.trim().toLowerCase() || "youness",
      document.getElementById("cfg_g1_1")?.value.trim().toLowerCase() || "mokhtar",
      document.getElementById("cfg_g1_2")?.value.trim().toLowerCase() || "aziz"
    ];
    G2 = [
      document.getElementById("cfg_g2_0")?.value.trim().toLowerCase() || "youssef",
      document.getElementById("cfg_g2_1")?.value.trim().toLowerCase() || "zakaria",
      document.getElementById("cfg_g2_2")?.value.trim().toLowerCase() || "mohamed"
    ];
    try {
      localStorage.setItem("gc_team_names", JSON.stringify({ g1: G1, g2: G2 }));
    } catch (e) {}
    updateTeamLabelsAndBadges();
  }

  function updateTeamLabelsAndBadges() {
    const opt1 = document.getElementById("opt_g1");
    if (opt1) opt1.textContent = `Groupe 1 (${G1.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(', ')})`;
    const opt2 = document.getElementById("opt_g2");
    if (opt2) opt2.textContent = `Groupe 2 (${G2.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(', ')})`;

    const container = document.getElementById("quickBadgesContainer");
    if (container) {
      let html = "";
      G1.forEach(name => {
        const cap = name.charAt(0).toUpperCase() + name.slice(1);
        html += `<button class="name-chip g1" type="button" onclick="insertNameBadge('${GC.escapeHtml(name)}')">+ ${GC.escapeHtml(cap)}</button>`;
      });
      G2.forEach(name => {
        const cap = name.charAt(0).toUpperCase() + name.slice(1);
        html += `<button class="name-chip g2" type="button" onclick="insertNameBadge('${GC.escapeHtml(name)}')">+ ${GC.escapeHtml(cap)}</button>`;
      });
      html += `<button class="name-chip special" type="button" onclick="insertNameBadge('— Repos —')">+ Repos</button>`;
      container.innerHTML = html;
    }

    const allNames = [...G1, ...G2];
    const nameOptionsHtml = allNames.map(n => `<option value="${GC.escapeHtml(n)}">${GC.escapeHtml(n.charAt(0).toUpperCase() + n.slice(1))}</option>`).join("");

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
    } else {
      navigator.clipboard.writeText(name).then(() => {
        GC.showToast(`📋 Nom copié : ${name}`);
      });
    }
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
    const regex = new RegExp(`\\b${oldName}\\b`, "gi");
    inputs.forEach(input => {
      if (regex.test(input.value)) {
        input.value = input.value.replace(regex, newName);
        count++;
      }
    });
    GC.showToast(`✨ "${oldName}" remplacé par "${newName}" (${count} occurrences modifiées).`);
    document.getElementById("repNewName").value = "";
    updateSyncStatus("editing");
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
    } else {
      alert(`Aucune affectation trouvée pour "${staffName}" sur la période sélectionnée.`);
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     8. MOTEUR DE ROTATION CARRÉE & TABLEAU ÉDITABLE
     ════════════════════════════════════════════════════════════════════ */
  function generatePlanningData() {
    const startStr = document.getElementById("genStartDate").value;
    if (!startStr) { alert("Veuillez sélectionner une date de départ."); return; }
    
    const startGroup = parseInt(document.getElementById("genStartGroup").value, 10);
    const weeksCount = parseInt(document.getElementById("genWeeksCount").value, 10);
    const alertMsg   = document.getElementById("genAlertMsg").value.trim();

    const [sy, sm, sd] = startStr.split("-").map(Number);
    let currDate = new Date(sy, sm - 1, sd);
    const generatedRows = [];

    for (let w = 0; w < weeksCount; w++) {
      const isG1Matin = (startGroup === 1 && w % 2 === 0) || (startGroup === 2 && w % 2 === 1);
      const matinGroup = isG1Matin ? G1 : G2;
      const soirGroup  = isG1Matin ? G2 : G1;

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
        let matinStr = "", soirStr = "";

        if (d === 0) {
          matinStr = `${matinGroup[0]} (SAL1), ${matinGroup[0]} (TER2), ${matinGroup[1]} (TER1), ${matinGroup[1]} (SAL2), ${matinGroup[1]} (LOG)`;
          soirStr  = `${soirGroup[0]} (SAL1), ${soirGroup[0]} (TER2), ${soirGroup[1]} (TER1), ${soirGroup[1]} (SAL2), ${soirGroup[1]} (LOG)`;
        } else if (d === 1) {
          matinStr = `${matinGroup[1]} (SAL1), ${matinGroup[1]} (TER2), ${matinGroup[2]} (TER1), ${matinGroup[2]} (SAL2), ${matinGroup[2]} (LOG)`;
          soirStr  = `${soirGroup[2]} (SAL1), ${soirGroup[2]} (TER2), ${soirGroup[0]} (TER1), ${soirGroup[0]} (SAL2), ${soirGroup[0]} (LOG)`;
        } else if (d === 2) {
          matinStr = `${matinGroup[2]} (SAL1), ${matinGroup[2]} (TER2), ${matinGroup[0]} (TER1), ${matinGroup[0]} (SAL2), ${matinGroup[0]} (LOG)`;
          soirStr  = `${soirGroup[1]} (SAL1), ${soirGroup[1]} (TER2), ${soirGroup[2]} (TER1), ${soirGroup[2]} (SAL2), ${soirGroup[2]} (LOG)`;
        } else if (d === 3) {
          matinStr = `${matinGroup[0]} (SAL1), ${matinGroup[0]} (TER3), ${matinGroup[2]} (SAL2), ${matinGroup[2]} (LOG), ${matinGroup[1]} (TER1), ${matinGroup[1]} (TER2)`;
          soirStr  = `${soirGroup[2]} (SAL1), ${soirGroup[2]} (TER3), ${soirGroup[1]} (SAL2), ${soirGroup[1]} (LOG), ${soirGroup[0]} (TER1), ${soirGroup[0]} (TER2)`;
        } else if (d === 4) {
          matinStr = `${matinGroup[2]} (SAL1), ${matinGroup[2]} (TER3), ${matinGroup[1]} (SAL2), ${matinGroup[1]} (LOG), ${matinGroup[0]} (TER1), ${matinGroup[0]} (TER2)`;
          soirStr  = `${soirGroup[1]} (SAL1), ${soirGroup[1]} (TER3), ${soirGroup[0]} (SAL2), ${soirGroup[0]} (LOG), ${soirGroup[2]} (TER1), ${soirGroup[2]} (TER2)`;
        } else if (d === 5) {
          matinStr = `${matinGroup[1]} (SAL1), ${matinGroup[1]} (TER3), ${matinGroup[0]} (SAL2), ${matinGroup[0]} (LOG), ${matinGroup[2]} (TER1), ${matinGroup[2]} (TER2)`;
          soirStr  = `${soirGroup[0]} (SAL1), ${soirGroup[0]} (TER3), ${soirGroup[2]} (SAL2), ${soirGroup[2]} (LOG), ${soirGroup[1]} (TER1), ${soirGroup[1]} (TER2)`;
        } else if (d === 6) {
          matinStr = `${matinGroup[0]} (SAL1), ${matinGroup[1]} (SAL2), ${matinGroup[1]} (TER3), ${matinGroup[2]} (TER1), ${matinGroup[2]} (TER2), ${soirGroup[2]} (LOG), ${soirGroup[0]} (deb)`;
          soirStr  = `${soirGroup[1]} (SAL1), ${soirGroup[1]} (TER3), ${soirGroup[0]} (SAL2), ${soirGroup[0]} (LOG), ${soirGroup[2]} (TER1), ${soirGroup[2]} (TER2)`;
        }

        generatedRows.push({
          isHeader: false,
          date: dateLabel,
          matin: matinStr,
          soir: soirStr,
          note: "",
          hMatin: "06:30-14:30",
          hSoir: "14:15- Fin service"
        });
        currDate.setDate(currDate.getDate() + 1);
      }
    }

    renderEditableTable(generatedRows);
    updateSyncStatus("editing");
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
        <td><input type="text" class="cell-date" value="${GC.escapeHtml(r.date)}" oninput="updateSyncStatus('editing')" /></td>
        <td><textarea rows="2" class="cell-shift" oninput="updateSyncStatus('editing')">${GC.escapeHtml(r.matin)}</textarea></td>
        <td><textarea rows="2" class="cell-shift" oninput="updateSyncStatus('editing')">${GC.escapeHtml(r.soir)}</textarea></td>
        <td><input type="text" class="cell-note" value="${GC.escapeHtml(r.note)}" placeholder="Note/Alerte..." oninput="updateSyncStatus('editing')" /></td>
        <td><input type="text" class="cell-time" value="${GC.escapeHtml(r.hMatin)}" oninput="updateSyncStatus('editing')" /></td>
        <td><input type="text" class="cell-time" value="${GC.escapeHtml(r.hSoir)}" oninput="updateSyncStatus('editing')" /></td>
        <td><button class="btn-del-row" onclick="this.closest('tr').remove(); updateSyncStatus('editing');" title="Supprimer">✕</button></td>
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

    GC.showToast("✨ Planning généré avec rotation carrée !");
  }

  function addNewDayRow() {
    const tbody = document.getElementById("editTableBody");
    if (!tbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" class="cell-date" value="lundi..." oninput="updateSyncStatus('editing')" /></td>
      <td><textarea rows="2" class="cell-shift" oninput="updateSyncStatus('editing')"></textarea></td>
      <td><textarea rows="2" class="cell-shift" oninput="updateSyncStatus('editing')"></textarea></td>
      <td><input type="text" class="cell-note" value="" placeholder="Note/Alerte..." oninput="updateSyncStatus('editing')" /></td>
      <td><input type="text" class="cell-time" value="06:30-14:30" oninput="updateSyncStatus('editing')" /></td>
      <td><input type="text" class="cell-time" value="14:15- Fin service" oninput="updateSyncStatus('editing')" /></td>
      <td><button class="btn-del-row" onclick="this.closest('tr').remove(); updateSyncStatus('editing');">✕</button></td>
    `;
    tbody.appendChild(tr);
    updateSyncStatus("editing");
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
  window.openGeneratorDashboard = openGeneratorDashboard;
  window.closeGeneratorModal = closeGeneratorModal;
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
  window.toggleLeaveConfigCard = toggleLeaveConfigCard;
  window.loadTeamNames = loadTeamNames;
  window.saveTeamNames = saveTeamNames;
  window.insertNameBadge = insertNameBadge;
  window.replaceNameGlobally = replaceNameGlobally;
  window.toggleLeaveActionInputs = toggleLeaveActionInputs;
  window.applyLeavePeriod = applyLeavePeriod;
  window.generatePlanningData = generatePlanningData;
  window.renderEditableTable = renderEditableTable;
  window.addNewDayRow = addNewDayRow;
  window.extractTableData = extractTableData;
  window.exportToGoogleSheetsClipboard = exportToGoogleSheetsClipboard;
  window.downloadCsvFile = downloadCsvFile;
  window.applyGeneratedToLiveView = applyGeneratedToLiveView;

})(typeof window !== 'undefined' ? window : globalThis);
