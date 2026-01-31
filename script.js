const legContainer = document.getElementById("legs-container");
const addLegBtn = document.getElementById("add-leg");
const generateBtn = document.getElementById("generate-pdf");
const form = document.getElementById("nav-form");
let consoInput;

let legs = [{}, {}, {}]; // 3 étapes par défaut

const fuelPhaseIds = [
  { id: "t_roulage", fuelId: "fuel_roulage", label: "Roulage / Départ" },
  { id: "t_trajet", fuelId: "fuel_trajet", label: "Trajet" },
  { id: "t_res_vent", fuelId: "fuel_res_vent", label: "Réserve vent" },
  { id: "t_proc", fuelId: "fuel_proc", label: "Procédure arrivée" },
  { id: "t_res_obl", fuelId: "fuel_res_obl", label: "Réserve obligatoire" },
  { id: "t_res_com", fuelId: "fuel_res_com", label: "Réserve commandant" },
];

function renderLegs() {
  if (!legContainer) return;
  legContainer.innerHTML = "";
  
  legs.forEach((leg, index) => {
    const row = document.createElement("tr");
    row.className = "leg-point-row";

    const createCell = (className, inputType, placeholder, value, onChange, min, step, max) => {
      const cell = document.createElement("td");
      if (className) cell.className = className;
      const input = document.createElement("input");
      input.type = inputType || "text";
      input.placeholder = placeholder;
      input.value = value || "";
      if (min !== undefined) input.min = min;
      if (step !== undefined) input.step = step;
      if (max !== undefined) input.max = max;
      input.addEventListener("input", onChange);
      cell.appendChild(input);
      return cell;
    };

    row.appendChild(createCell("leg-seg-cell", "number", "Alti QNH", leg.alti, (e) => { leg.alti = e.target.value; }, "0", "1"));
    row.appendChild(createCell("leg-seg-cell", "number", "Temps sans vent", leg.tsv, (e) => { leg.tsv = e.target.value; }, "0", "1"));
    row.appendChild(createCell("leg-seg-cell", "number", "Dist (NM)", leg.dist, (e) => { leg.dist = e.target.value; }, "0", "0.1"));
    row.appendChild(createCell("leg-seg-cell", "number", "RM avec vent", leg.rmVent, (e) => { leg.rmVent = validateCap(e.target.value); e.target.value = leg.rmVent; }, "0", "1", "360"));
    row.appendChild(createCell("leg-seg-cell", "number", "RM sans vent", leg.rmSans, (e) => { leg.rmSans = validateCap(e.target.value); e.target.value = leg.rmSans; }, "0", "1", "360"));

    const spacerCell = document.createElement("td");
    spacerCell.className = "leg-spacer-cell";
    row.appendChild(spacerCell);

    row.appendChild(createCell("leg-point-cell", "text", "Report", leg.report, (e) => { leg.report = e.target.value; }));
    row.appendChild(createCell("leg-point-cell", "text", "Heure ESTI", leg.hEsti, (e) => { leg.hEsti = e.target.value; }));

    row.appendChild(createCell("", "text", "Notes", leg.notes, (e) => { leg.notes = e.target.value; }));

    if (legs.length > 1) {
      const lastCell = row.lastElementChild;
      lastCell.style.position = "relative";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        legs.splice(index, 1);
        renderLegs();
      });
      lastCell.appendChild(removeBtn);
    }
    legContainer.appendChild(row);
  });
}

function getConsoRate() {
  const val = document.getElementById("conso_h")?.value;
  const num = Number(val);
  return isNaN(num) || num <= 0 ? 0 : num;
}
// Fonctions utilitaires pour le PDF
function formatTime(minutes) {
  if (!minutes || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${minutes} mn (${hours}h${mins < 10 ? '0' : ''}${mins}mn)`;
}

function formatNumber(value, decimals = 1) {
  if (!value || value === "" || isNaN(value)) return "";
  const num = Number(value);
  return num.toFixed(decimals);
}

function validateCap(value) {
  if (!value || value === "") return "";
  const num = Number(value);
  if (isNaN(num)) return value; // Garde la valeur originale si ce n'est pas un nombre
  return Math.min(Math.max(0, num), 360).toString();
}

// QFU : normalise et calcule le QFU réciproque
function normalizeQfu(val) {
  const num = Math.round(Number(val));
  if (!isFinite(num) || num <= 0) return "";
  let rw = ((num % 36) + 36) % 36;
  if (rw === 0) rw = 36;
  return rw.toString().padStart(2, "0");
}

function reciprocalQfu(val) {
  const norm = normalizeQfu(val);
  if (!norm) return "";
  const num = Number(norm);
  let recip = ((num + 17) % 36) + 1; // +180° -> +18 en numéro de piste
  if (recip === 0) recip = 36;
  return recip.toString().padStart(2, "0");
}

function formatQfuPair(id1, id2) {
  const v1 = normalizeQfu(document.getElementById(id1)?.value || "");
  const v2 = normalizeQfu(document.getElementById(id2)?.value || "");
  return [v1, v2].filter(Boolean).join(" / ");
}

function updateFuelPhase(phaseId, fuelId) {
  const timeInput = document.getElementById(phaseId);
  const fuelEl = document.getElementById(fuelId);
  if (!timeInput || !fuelEl) return;

  const minutes = Number(timeInput.value) || 0;
  const rate = getConsoRate();
  const liters = (minutes / 60) * rate;
  fuelEl.textContent = liters > 0 ? liters.toFixed(1) : "-";
}

function updateAllFuelPhases() {
  fuelPhaseIds.forEach(({ id, fuelId }) => updateFuelPhase(id, fuelId));

  const totalMinutes = fuelPhaseIds.reduce((sum, { id }) => {
    return sum + (Number(document.getElementById(id)?.value) || 0);
  }, 0);

  const rate = getConsoRate();
  const totalFuel = (totalMinutes / 60) * rate;

  // Calculer le total des réservoirs
  const carbG = Number(document.getElementById("carb_g")?.value) || 0;
  const carbC = Number(document.getElementById("carb_c")?.value) || 0;
  const carbP = Number(document.getElementById("carb_p")?.value) || 0;
  const totalReservoirs = carbG + carbC + carbP;

  const timeTotalEl = document.getElementById("time_total");
  const fuelTotalEl = document.getElementById("fuel_total");
  const fuelTotalContainer = fuelTotalEl?.parentElement;

  if (timeTotalEl) {
    if (totalMinutes > 0) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      timeTotalEl.textContent = `${totalMinutes} mn (${hours}h${minutes < 10 ? '0' : ''}${minutes})`;
    } else {
      timeTotalEl.textContent = "-";
    }
  }

  if (fuelTotalEl) {
    fuelTotalEl.textContent = totalFuel > 0 ? totalFuel.toFixed(1) : "-";
    
    // Vérifier si le total calculé dépasse les réservoirs
    const fuelTotalContainer = fuelTotalEl.parentElement?.parentElement; // .fuel-phase.total
    if (fuelTotalContainer) {
      // Retirer l'erreur précédente si elle existe
      const existingError = fuelTotalContainer.querySelector(".fuel-error");
      if (existingError) {
        existingError.remove();
      }

      // Afficher une erreur si nécessaire
      if (totalFuel > 0 && totalReservoirs > 0 && totalFuel > totalReservoirs) {
        fuelTotalEl.style.color = "#f77272";
        fuelTotalEl.style.fontWeight = "700";
        const errorMsg = document.createElement("div");
        errorMsg.className = "fuel-error";
        errorMsg.style.color = "#f77272";
        errorMsg.style.fontSize = "13px";
        errorMsg.style.fontWeight = "600";
        errorMsg.style.marginTop = "8px";
        errorMsg.style.padding = "8px 12px";
        errorMsg.style.backgroundColor = "rgba(247, 114, 114, 0.15)";
        errorMsg.style.border = "1px solid rgba(247, 114, 114, 0.4)";
        errorMsg.style.borderRadius = "6px";
        errorMsg.style.width = "100%";
        errorMsg.textContent = `⚠️ Carburant insuffisant ! ${totalFuel.toFixed(1)} L nécessaires, mais seulement ${totalReservoirs.toFixed(1)} L disponible`;
        fuelTotalContainer.appendChild(errorMsg);
        
        // Ajouter un style au conteneur pour rendre l'alerte plus visible
        fuelTotalContainer.style.borderColor = "#f77272";
        fuelTotalContainer.style.backgroundColor = "rgba(247, 114, 114, 0.08)";
      } else {
        fuelTotalEl.style.color = "";
        fuelTotalEl.style.fontWeight = "";
        if (fuelTotalContainer.classList.contains("fuel-phase")) {
          fuelTotalContainer.style.borderColor = "";
          fuelTotalContainer.style.backgroundColor = "";
        }
      }
    }
  }
}

function initFuelCalculations() {
  consoInput = document.getElementById("conso_h");
  fuelPhaseIds.forEach(({ id }) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("input", updateAllFuelPhases);
    }
  });
  if (consoInput) {
    consoInput.addEventListener("input", updateAllFuelPhases);
  }
  
  // Écouter aussi les changements de carburant dans les réservoirs
  const carbGInput = document.getElementById("carb_g");
  const carbCInput = document.getElementById("carb_c");
  const carbPInput = document.getElementById("carb_p");
  if (carbGInput) carbGInput.addEventListener("input", updateAllFuelPhases);
  if (carbCInput) carbCInput.addEventListener("input", updateAllFuelPhases);
  if (carbPInput) carbPInput.addEventListener("input", updateAllFuelPhases);
  
  updateAllFuelPhases();
}

function collectTimes(rate) {
  const phases = [
    { id: "t_roulage", label: "ROULAGE/DEPART" },
    { id: "t_trajet", label: "TRAJET" },
    { id: "t_res_vent", label: "RESERVE VENT" },
    { id: "t_proc", label: "PROC ARRIVEE" },
    { id: "t_res_obl", label: "RESERVE OBL" },
    { id: "t_res_com", label: "RESERVE COM" },
  ];

  let total = 0;
  let totalFuel = 0;

  const table = phases.map((p) => {
    const minutes = Number(document.getElementById(p.id)?.value) || 0;
    const fuel = (minutes / 60) * rate;
    total += minutes;
    totalFuel += fuel;
    return [
      minutes > 0 ? `${minutes}` : "",
      p.label,
      fuel > 0 ? formatNumber(fuel, 1) : "",
    ];
  });

  table.push([
    total > 0 ? formatTime(total) : "",
    "TOTAL",
    totalFuel > 0 ? formatNumber(totalFuel, 1) : "",
  ]);

  return table;
}

function buildPdf() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.error("jsPDF non disponible:", window.jspdf);
    alert("Erreur: La bibliothèque PDF n'est pas chargée. Vérifiez votre connexion internet et rechargez la page.");
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 10;
  const marginRight = 10;
  const marginTop = 15;
  const marginBottom = 15;
  const usableWidth = pageWidth - marginLeft - marginRight;
  const usableHeight = pageHeight - marginTop - marginBottom;
  
  // Palette et mise en page
  let y = marginTop;
  const rate = Number(document.getElementById("conso_h")?.value) || 0;

  // PAGE 1 - En-tête bandeau
  doc.setFillColor(30, 41, 59); // bandeau sombre
  doc.rect(0, 5, pageWidth, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Log de navigation", pageWidth / 2, 17, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Préparation de vol VFR", pageWidth / 2, 22, { align: "center" });

  // Retour au style par défaut pour le contenu
  doc.setTextColor(0, 0, 0);
  y = marginTop + 20;

  // Structure à deux colonnes : Gauche (Aéroport départ) et Droite (Météo/ATIS)
  const colLeftX = marginLeft;
  const colRightX = marginLeft + usableWidth / 2 + 5;
  const colWidth = (usableWidth - 10) / 2;
  let yLeft = y;
  let yRight = y;

  // SECTION GAUCHE - Aéroport de départ
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Aéroport de départ :", colLeftX, yLeft);
  yLeft += 7;

  // Tableau infos départ (champ / valeur)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const depData = [
    ["ATIS", document.getElementById("atis_freq_dep")?.value || ""],
    ["APP", document.getElementById("app_dep")?.value || ""],
    ["TWR", document.getElementById("twr_dep")?.value || ""],
    ["SOL", document.getElementById("sol_dep")?.value || ""],
    ["QFU", formatQfuPair("qfu_dep1", "qfu_dep2")],
    ["ALTI", (document.getElementById("alti_dep")?.value || "") + " ft"],
    ["HEURES MOTEUR D", ""], // Laissé vide pour remplissage manuel
    ["HEURES MOTEUR A", ""], // Laissé vide pour remplissage manuel
  ];

  doc.autoTable({
    head: [["Champ", "Valeur"]],
    body: depData,
    startY: yLeft,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fontStyle: "bold", fillColor: [54, 86, 128], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: colLeftX },
    tableWidth: colWidth,
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: colWidth - 26 },
    },
  });
  yLeft = doc.lastAutoTable.finalY + 4;

  // Observations départ
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("OBS :", colLeftX, yLeft);
  yLeft += 5;
  doc.setFont("helvetica", "normal");
  const obsDep = document.getElementById("obs_dep")?.value || "";
  doc.text(obsDep, colLeftX, yLeft, { maxWidth: colWidth - 5 });

  // SECTION DROITE - Météo/ATIS Départ
  yRight = y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Atis", colRightX, yRight);
  yRight += 6;

  // Tableau ATIS
  doc.autoTable({
    head: [["INFO", "PISTE/VISI", "", "", "kt"]],
    body: [
      ["", "TEMPERATURE", "°", "", "PDR: °"],
      ["", "VENT/PLAFOND", "°", "kt", "ft"],
      ["", "QNH", "hPa", "", ""],
      ["", "QFE", "hPa", "", ""],
      ["", "OBS", "", "", ""],
    ],
    startY: yRight,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, lineColor: [210, 220, 230], lineWidth: 0.1 },
    headStyles: { fontStyle: "bold", fillColor: [54, 86, 128], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 30 },
      2: { cellWidth: 10 },
      3: { cellWidth: 10 },
      4: { cellWidth: 15 },
    },
    margin: { left: colRightX },
  });
  yRight = doc.lastAutoTable.finalY + 8;

  // Bloc Carburant (après les colonnes)
  y = Math.max(yLeft, yRight) + 10;

  // Carburant total à bord
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Carburant :", marginLeft, y);
  doc.setFont("helvetica", "normal");
  const carbG = document.getElementById("carb_g")?.value || "";
  const carbC = document.getElementById("carb_c")?.value || "";
  const carbP = document.getElementById("carb_p")?.value || "";
  doc.text(`G : ${carbG ? formatNumber(carbG, 1) : ""} L  C : ${carbC ? formatNumber(carbC, 1) : ""} L  P : ${carbP ? formatNumber(carbP, 1) : ""} L`, marginLeft + 25, y);
  y += 8;

  // === Bloc Carburant & Consommation ===
  doc.setDrawColor(210, 220, 230);
  doc.setFillColor(248, 250, 252);
  const carbBoxY = y - 6;
  doc.roundedRect(marginLeft - 1, carbBoxY, usableWidth + 2, 40, 2, 2, "S");

  // Titre de section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Carburant & Temps de vol", marginLeft + 2, carbBoxY + 6);

  y = carbBoxY + 12;

  // Ligne carburant total
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const carbLine = `G : ${carbG ? formatNumber(carbG, 1) : ""} L   C : ${carbC ? formatNumber(carbC, 1) : ""} L   P : ${carbP ? formatNumber(carbP, 1) : ""} L`;
  doc.text(carbLine, marginLeft + 2, y);
  y += 5;

  // Consommation + éventuelles observations carburant
  const conso = document.getElementById("conso_h")?.value || "";
  const carbObs = document.getElementById("carb_obs")?.value || "";
  doc.text("Consommation : " + (conso ? formatNumber(conso, 1) + " L/h" : ""), marginLeft + 2, y);
  if (carbObs) {
    doc.text("Obs carburant : " + carbObs, marginLeft + 2, y + 5, { maxWidth: usableWidth - 4 });
    y += 9;
  } else {
    y += 5;
  }

  // Tableau TEMPS / PERIODE DU VOL / CONSO (L)
  const timesData = collectTimes(rate);
  doc.autoTable({
    head: [["TEMPS (mn)", "PERIODE DU VOL", "CONSO (L)"]],
    body: timesData,
    startY: y,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.2, lineColor: [210, 220, 230], lineWidth: 0.1 },
    headStyles: { fontStyle: "bold", fillColor: [54, 86, 128], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: function(data) {
      // Mettre en évidence la ligne TOTAL
      if (data.row.raw && data.row.raw[1] === "TOTAL") {
        data.cell.styles.fillColor = [240, 248, 255];
        data.cell.styles.fontStyle = "bold";
      }
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 62 },
      2: { cellWidth: 22, halign: "right" },
    },
    margin: { left: marginLeft, right: marginRight },
    tableWidth: usableWidth,
  });
  y = doc.lastAutoTable.finalY + 6;

  // Section Avion (après le bloc carburant)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Avion :", marginLeft, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const avionType = document.getElementById("avion_type")?.value || "";
  const avionImmat = document.getElementById("avion_immat")?.value || "";
  doc.text(`Type: ${avionType}`, marginLeft, y);
  y += 5;
  doc.text(`Immat: ${avionImmat}`, marginLeft, y);
  y += 5;
  const vcr = document.getElementById("vcr")?.value || "";
  const masseMax = document.getElementById("masse_max")?.value || "";
  if (vcr) {
    doc.text(`VCR: ${formatNumber(vcr, 1)} Kt`, marginLeft, y);
    y += 5;
  }
  if (masseMax) {
    doc.text(`Masse max: ${formatNumber(masseMax, 1)} kg`, marginLeft, y);
    y += 5;
  }
  const nbPassagers = document.getElementById("nb_passagers")?.value || "";
  const altMax = document.getElementById("altitude_max")?.value || "";
  const mtow = document.getElementById("mtow")?.value || "";
  if (nbPassagers || altMax || mtow) {
    if (nbPassagers) {
      doc.text(`Passagers: ${nbPassagers}`, marginLeft, y);
      y += 5;
    }
    if (altMax) {
      doc.text(`Alt max: ${formatNumber(altMax, 0)} ft`, marginLeft, y);
      y += 5;
    }
    if (mtow) {
      doc.text(`MTOW: ${formatNumber(mtow, 1)} kg`, marginLeft, y);
      y += 5;
    }
  }
  y += 5;

  // Tableau de Navigation Principal
  const legBody = legs.map((leg) => [
    leg.alti ? formatNumber(leg.alti, 0) : "",
    leg.tsv ? formatNumber(leg.tsv, 0) : "",
    leg.dist ? formatNumber(leg.dist, 1) : "",
    leg.rmVent ? formatNumber(validateCap(leg.rmVent), 0) : "",
    leg.rmSans ? formatNumber(validateCap(leg.rmSans), 0) : "",
    leg.report || "",
    leg.hEsti || "",
    leg.hReel || "",
    leg.notes || "",
  ]);

  // Ligne TOTAL
  legBody.push([
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);

  // Calculer combien de lignes on peut mettre sur cette page
  const tableStartY = y;
  // Calculer l'espace disponible pour le tableau (en tenant compte qu'on ne veut pas couper au milieu)
  const availableHeight = pageHeight - marginBottom - tableStartY - 10;
  // Chaque ligne fait environ 6mm (avec padding), on prend une marge de sécurité
  const rowsPerPage = Math.floor(availableHeight / 6.5);
  // On s'assure qu'on ne coupe pas au milieu : si on est trop près du bas, on passe à la page suivante
  const legsForPage1 = legBody.slice(0, Math.max(1, rowsPerPage - 1));

  doc.autoTable({
    head: [["ALTI QNH", "Temps sans vent", "DIST NM", "RM Avec vent", "RM Sans vent", "Report", "ESTI", "REEL", "NOTES"]],
    body: legsForPage1,
    startY: tableStartY,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2, lineColor: [210, 220, 230], lineWidth: 0.1 },
    headStyles: { fontStyle: "bold", fillColor: [54, 86, 128], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    tableWidth: usableWidth,
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 12 },
      2: { cellWidth: 18 },
      3: { cellWidth: 27 },
      4: { cellWidth: 27 },
      5: { cellWidth: 28 },
      6: { cellWidth: 8, halign: "center" },
      7: { cellWidth: 8, halign: "center" },
      8: { cellWidth: 30 },
    },
    margin: { left: marginLeft, right: marginRight },
    didParseCell: function(data) {
      const isTotalRow = legsForPage1[data.row.index] && legsForPage1[data.row.index][0] === "TOTAL";
      if (isTotalRow && data.column.index === 0) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Si besoin de plusieurs pages pour le tableau de navigation
  let remainingLegs = legBody.slice(legsForPage1.length);
  let pageNum = 2;

  while (remainingLegs.length > 0) {
    doc.addPage();
    y = marginTop;

    const rowsPerPage2 = Math.floor((pageHeight - marginBottom - y - 15) / 6);
    const legsForPage = remainingLegs.slice(0, rowsPerPage2);

  doc.autoTable({
    head: [["ALTI QNH", "Temps sans vent", "DIST NM", "RM Avec vent", "RM Sans vent", "Report", "ESTI", "REEL", "NOTES"]],
      body: legsForPage,
      startY: y,
      theme: "grid",
    styles: { fontSize: 7, cellPadding: 2, lineColor: [210, 220, 230], lineWidth: 0.1 },
    headStyles: { fontStyle: "bold", fillColor: [54, 86, 128], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    tableWidth: usableWidth,
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 12 },
        2: { cellWidth: 18 },
        3: { cellWidth: 27 },
        4: { cellWidth: 27 },
        5: { cellWidth: 28 },
        6: { cellWidth: 8, halign: "center" },
        7: { cellWidth: 8, halign: "center" },
        8: { cellWidth: 30 },
      },
      margin: { left: marginLeft },
      didParseCell: function(data) {
        const isTotalRow = legsForPage[data.row.index] && legsForPage[data.row.index][0] === "TOTAL";
        if (isTotalRow && data.column.index === 0) {
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    remainingLegs = remainingLegs.slice(rowsPerPage2);
    pageNum++;
  }

  // Dernière page - Bloc Arrivée (si on n'a pas déjà une nouvelle page)
  if (pageNum === 2 && remainingLegs.length === 0) {
    // On reste sur la page 1, on continue
    y = doc.lastAutoTable.finalY + 10;
  } else {
    // On ajoute une nouvelle page
    doc.addPage();
    y = marginTop;
  }

  // Section Notes générales (encadrée)
  const notesTitle = "Notes générales";
  doc.setDrawColor(210, 220, 230);
  doc.setFillColor(248, 250, 252);
  const notesBoxY = y;
  const notesText = document.getElementById("notes_globales")?.value || "";
  const notesHeight = Math.max(24, doc.getTextDimensions(notesText || " ", { maxWidth: usableWidth - 4 }).h + 10);
  doc.roundedRect(marginLeft - 1, notesBoxY, usableWidth + 2, notesHeight + 10, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(notesTitle, marginLeft + 2, notesBoxY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (notesText) {
    doc.text(notesText, marginLeft + 2, notesBoxY + 12, { maxWidth: usableWidth - 4 });
  }
  y = notesBoxY + notesHeight + 14;

  // Bloc Arrivée
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Aéroport d'Arrivée :", marginLeft, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const arrData = [
    ["ATIS", document.getElementById("atis_freq_arr")?.value || ""],
    ["APP", document.getElementById("app_arr")?.value || ""],
    ["TWR", document.getElementById("twr_arr")?.value || ""],
    ["SOL", document.getElementById("sol_arr")?.value || ""],
    ["QFU", formatQfuPair("qfu_arr1", "qfu_arr2")],
    ["ALTI", (document.getElementById("alti_arr")?.value || "") + " ft"],
  ];

  doc.autoTable({
    head: [["Champ", "Valeur"]],
    body: arrData,
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fontStyle: "bold", fillColor: [54, 86, 128], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: marginLeft },
    tableWidth: usableWidth / 2,
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: usableWidth / 2 - 26 },
    },
  });
  y = doc.lastAutoTable.finalY + 6;
  
  // Tableau ATIS Arrivée
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Atis", marginLeft, y);
  y += 6;

  doc.autoTable({
    head: [["INFO", "PISTE/VISI", "", "", "kt"]],
    body: [
      ["", "TEMPERATURE", "°", "", "PDR: °"],
      ["", "VENT/PLAFOND", "°", "kt", "ft"],
      ["", "QNH", "hPa", "", ""],
      ["", "QFE", "hPa", "", ""],
      ["", "OBS", "", "", ""],
    ],
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, lineColor: [210, 220, 230], lineWidth: 0.1 },
    headStyles: { fontStyle: "bold", fillColor: [54, 86, 128], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 30 },
      2: { cellWidth: 10 },
      3: { cellWidth: 10 },
      4: { cellWidth: 15 },
    },
    margin: { left: marginLeft, right: marginRight },
  });

  y = doc.lastAutoTable.finalY + 6;
  doc.setFont("helvetica", "bold");
  doc.text("OBS :", marginLeft, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  const obsArr = document.getElementById("obs_arr")?.value || "";
  doc.text(obsArr, marginLeft, y, { maxWidth: usableWidth });

  doc.save("log_de_nav.pdf");
}

// Chargement dynamique de jsPDF si absent
const pdfScripts = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js",
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src='${src}']`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", (e) => reject(e));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

async function ensurePdfLib() {
  // Vérifie d'abord si déjà chargé
  if (window.jspdf && window.jspdf.jsPDF) {
    console.log("jsPDF déjà disponible");
    return true;
  }
  
  // Attend un peu au cas où les scripts HTML sont en train de charger
  await new Promise(resolve => setTimeout(resolve, 100));
  if (window.jspdf && window.jspdf.jsPDF) {
    console.log("jsPDF chargé depuis les scripts HTML");
    return true;
  }
  
  // Sinon charge dynamiquement
  console.log("Chargement dynamique de jsPDF...");
  try {
    await Promise.all(pdfScripts.map(loadScript));
    await new Promise(resolve => setTimeout(resolve, 200));
    if (window.jspdf && window.jspdf.jsPDF) {
      console.log("jsPDF chargé avec succès");
      return true;
    }
  } catch (error) {
    console.error("Erreur lors du chargement des scripts PDF:", error);
  }
  
  return false;
}

async function initApp() {
  if (!generateBtn) {
    console.error("Bouton PDF non trouvé");
    return;
  }

  // Désactive le bouton le temps de charger la lib
  generateBtn.disabled = true;
  generateBtn.textContent = "Chargement PDF...";

  const pdfReady = await ensurePdfLib();

  generateBtn.disabled = false;
  generateBtn.textContent = "Télécharger le PDF";

  if (!pdfReady) {
    console.warn("jsPDF pourrait ne pas être disponible");
  }

  if (addLegBtn) {
    addLegBtn.addEventListener("click", (e) => {
      e.preventDefault();
      legs.push({});
      renderLegs();
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const ready = await ensurePdfLib();
        if (!ready) {
          alert("Erreur: La bibliothèque PDF n'est pas chargée. Vérifiez votre connexion internet et rechargez la page.");
          console.error("jsPDF non disponible. window.jspdf =", window.jspdf);
          return;
        }
        buildPdf();
      } catch (error) {
        console.error("Erreur lors de la génération du PDF:", error);
        alert("Erreur lors de la génération du PDF: " + error.message);
      }
    });
  }

  // Synchronisation QFU (réversible)
  function linkQfu(primaryId, secondaryId) {
    const primary = document.getElementById(primaryId);
    const secondary = document.getElementById(secondaryId);
    if (!primary || !secondary) return;
    let lock = false;
    const sync = (fromPrimary) => {
      if (lock) return;
      const src = fromPrimary ? primary : secondary;
      const dest = fromPrimary ? secondary : primary;
      const norm = normalizeQfu(src.value);
      lock = true;
      if (!norm) {
        dest.value = "";
        lock = false;
        return;
      }
      const recip = reciprocalQfu(norm);
      src.value = norm;
      dest.value = recip;
      lock = false;
    };
    primary.addEventListener("input", () => sync(true));
    secondary.addEventListener("input", () => sync(false));
  }

  linkQfu("qfu_dep1", "qfu_dep2");
  linkQfu("qfu_arr1", "qfu_arr2");

  // Bouton copier départ vers arrivée
  const copyBtn = document.getElementById("copy-dep-to-arr");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      // Copier les informations de l'aéroport de départ vers l'arrivée
      const fields = [
        { dep: "aero_dep", arr: "aero_arr" },
        { dep: "qfu_dep1", arr: "qfu_arr1" },
        { dep: "qfu_dep2", arr: "qfu_arr2" },
        { dep: "alti_dep", arr: "alti_arr" },
        { dep: "app_dep", arr: "app_arr" },
        { dep: "twr_dep", arr: "twr_arr" },
        { dep: "sol_dep", arr: "sol_arr" },
        { dep: "atis_freq_dep", arr: "atis_freq_arr" },
        { dep: "obs_dep", arr: "obs_arr" }
      ];

      fields.forEach(({ dep, arr }) => {
        const depEl = document.getElementById(dep);
        const arrEl = document.getElementById(arr);
        if (depEl && arrEl && depEl.value) {
          arrEl.value = depEl.value;
        }
      });

      // Animation de confirmation
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "Copié ✓";
      copyBtn.style.background = "var(--success)";
      copyBtn.style.color = "white";
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.background = "";
        copyBtn.style.color = "";
      }, 1000);
    });
  }

  renderLegs();
  initFuelCalculations();
}

// Initialize when everything is ready
function startInit() {
  initApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startInit);
} else {
  startInit();
}
