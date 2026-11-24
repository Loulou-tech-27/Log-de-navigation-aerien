/* =========================================================
   pdf.js — génération du log de nav imprimable
   Mise en page « vraie » : points de report et branches en
   quinconce, cases vierges pour la saisie en vol.
   ========================================================= */

const PDF_SCRIPTS = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js",
];

function chargerScript(src) {
  return new Promise((resolve, reject) => {
    const existant = document.querySelector(`script[src='${src}']`);
    if (existant) {
      if (existant.dataset.charge === "1") return resolve();
      existant.addEventListener("load", () => resolve());
      existant.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => { s.dataset.charge = "1"; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function ensurePdfLib() {
  if (window.jspdf && window.jspdf.jsPDF) return true;
  await new Promise((r) => setTimeout(r, 120));
  if (window.jspdf && window.jspdf.jsPDF) return true;
  try {
    for (const src of PDF_SCRIPTS) await chargerScript(src);
    await new Promise((r) => setTimeout(r, 120));
  } catch (e) {
    console.error("Chargement jsPDF impossible", e);
  }
  return Boolean(window.jspdf && window.jspdf.jsPDF);
}

/* ---------------------------------------------------------
   Géométrie et palette
   --------------------------------------------------------- */

const PG = {
  w: 210, h: 297,
  m: 8,                       // marge latérale
  top: 8,
  bottom: 10,
  get width() { return this.w - 2 * this.m; },   // 194
  get right() { return this.w - this.m; },       // 202
};

const C = {
  encre:      [24, 34, 46],
  bandeau:    [20, 44, 72],
  bandeau2:   [39, 78, 118],
  pointFill:  [216, 231, 244],
  pointFill2: [235, 243, 250],
  legFill:    [250, 251, 253],
  border:     [128, 145, 165],
  borderFin:  [186, 197, 210],
  gris:       [112, 124, 138],
  grisClair:  [160, 170, 182],
  blanc:      [255, 255, 255],
  alerte:     [176, 42, 42],
  vert:       [26, 118, 78],
};

/* --- Primitives de dessin --- */

function T(doc, texte, x, y, o = {}) {
  const s = texte === null || texte === undefined ? "" : String(texte);
  if (s === "") return;
  doc.setFont("helvetica", o.style || "normal");
  doc.setFontSize(o.size || 9);
  const c = o.color || C.encre;
  doc.setTextColor(c[0], c[1], c[2]);
  doc.text(s, x, y, { align: o.align || "left", maxWidth: o.maxWidth, baseline: o.baseline || "alphabetic" });
}

function BOX(doc, x, y, w, h, o = {}) {
  const stroke = o.stroke === false ? null : (o.border || C.border);
  if (o.fill) doc.setFillColor(o.fill[0], o.fill[1], o.fill[2]);
  if (stroke) doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
  doc.setLineWidth(o.lw === undefined ? 0.22 : o.lw);
  const mode = o.fill && stroke ? "FD" : o.fill ? "F" : "S";
  if (o.r) doc.roundedRect(x, y, w, h, o.r, o.r, mode);
  else doc.rect(x, y, w, h, mode);
}

/**
 * Case de formulaire : petite légende en haut, valeur en bas.
 * Une valeur vide laisse volontairement la case vierge (saisie en vol).
 */
function CELL(doc, x, y, w, h, o = {}) {
  BOX(doc, x, y, w, h, { fill: o.fill, border: o.border || C.borderFin, lw: o.lw });
  if (o.cap) {
    T(doc, o.cap, x + 1.4, y + 2.9, {
      size: o.capSize || 5.2, style: "bold",
      color: o.capColor || C.grisClair,
    });
  }
  const val = o.val === null || o.val === undefined ? "" : String(o.val);
  if (val !== "") {
    const size = o.size || 8.5;
    const align = o.align || "left";
    const px = align === "center" ? x + w / 2 : align === "right" ? x + w - 1.6 : x + 1.6;
    const py = o.cap ? y + h - 1.9 : y + h / 2 + size * 0.13;
    T(doc, val, px, py, {
      size, align, style: o.style || "normal",
      color: o.color || C.encre,
      maxWidth: w - 2.6,
    });
  }
}

/** Bandeau de titre de section. */
function BANDE(doc, x, y, w, titre, o = {}) {
  const h = o.h || 5.4;
  BOX(doc, x, y, w, h, { fill: o.fill || C.bandeau, stroke: false });
  T(doc, titre, x + 2, y + h - 1.7, {
    size: o.size || 7.2, style: "bold", color: o.color || C.blanc,
  });
  if (o.droite) {
    T(doc, o.droite, x + w - 2, y + h - 1.7, {
      size: o.size || 7, style: "normal", color: o.color || C.blanc, align: "right",
    });
  }
  return y + h;
}

/** Lignes vierges pour écrire à la main. */
function LIGNES(doc, x, y, w, nb, pas = 5.2) {
  doc.setDrawColor(C.borderFin[0], C.borderFin[1], C.borderFin[2]);
  doc.setLineWidth(0.15);
  for (let i = 0; i < nb; i++) doc.line(x, y + pas * (i + 1), x + w, y + pas * (i + 1));
  return y + pas * nb + 1;
}

/* ---------------------------------------------------------
   Blocs de la page
   --------------------------------------------------------- */

function bandeauTitre(doc, state, d) {
  const y = PG.top;
  const h = 14;
  BOX(doc, PG.m, y, PG.width, h, { fill: C.bandeau, stroke: false });
  BOX(doc, PG.m, y, 2.2, h, { fill: C.bandeau2, stroke: false });

  T(doc, "LOG DE NAVIGATION VFR", PG.m + 5, y + 5.6, { size: 7.5, style: "bold", color: [150, 190, 220] });

  const route = [state.dep.icao, state.arr.icao].filter(Boolean).join("   »   ") || "________   »   ________";
  T(doc, route.toUpperCase(), PG.m + 5, y + 11.6, { size: 14, style: "bold", color: C.blanc });

  const av = [state.avion.type, state.avion.immat].filter(Boolean).join("  ·  ");
  T(doc, av || "Avion : ______________", PG.right - 4, y + 5.8, { size: 8.5, style: "bold", color: C.blanc, align: "right" });

  const dateTxt = state.meta.date ? formaterDate(state.meta.date) : "Date : ____ / ____ / ______";
  const pilote = state.meta.pilote ? `Pilote : ${state.meta.pilote}` : "Pilote : ______________";
  T(doc, `${dateTxt}     ${pilote}`, PG.right - 4, y + 11.4, { size: 8, color: [190, 212, 232], align: "right" });

  return y + h + 2.5;
}

function formaterDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
}

/** Bandeau d'informations rapides (certaines cases restent vierges). */
function bandeauInfos(doc, state, d) {
  const y = doc.__y;
  const h = 9.5;
  const cols = [
    { cap: "DÉCOLLAGE ESTIMÉ", val: state.meta.decollage || "", align: "center" },
    { cap: "DÉPART BLOC RÉEL", val: "", align: "center" },
    { cap: "DÉCOLLAGE RÉEL", val: "", align: "center" },
    { cap: "ATTERRISSAGE RÉEL", val: "", align: "center" },
    { cap: "ARRIVÉE BLOC RÉEL", val: "", align: "center" },
    { cap: "VP", val: state.avion.vcr ? `${state.avion.vcr} kt` : "", align: "center" },
    { cap: "VENT", val: ventTexte(state), align: "center" },
    { cap: "DM", val: state.nav.dm !== "" && state.nav.dm !== null ? `${state.nav.dm}°` : "", align: "center" },
  ];
  const w = PG.width / cols.length;
  cols.forEach((c, i) => {
    CELL(doc, PG.m + i * w, y, w, h, {
      cap: c.cap, val: c.val, align: "center", size: 9, style: "bold",
      fill: c.val === "" ? C.blanc : C.pointFill2,
    });
  });
  doc.__y = y + h + 2.5;
}

function ventTexte(state) {
  const dir = num(state.nav.ventDir);
  const vit = num(state.nav.ventVit);
  if (dir === null || vit === null) return "";
  return `${String(Math.round(dir)).padStart(3, "0")}°/${Math.round(vit)}kt`;
}

/** Bloc terrain (départ ou arrivée) : infos connues + ATIS vierge. */
function blocTerrain(doc, x, y, w, titre, t, opts = {}) {
  const hBande = 5.4;
  let cy = BANDE(doc, x, y, w, `${titre}${t.icao ? "   —   " + t.icao.toUpperCase() : ""}`, {
    fill: opts.fill || C.bandeau,
    droite: opts.droite,
  });

  const l1 = 8.4;
  const c3 = w / 3;
  CELL(doc, x, cy, c3, l1, { cap: "TERRAIN", val: (t.icao || "").toUpperCase(), style: "bold", size: 9 });
  CELL(doc, x + c3, cy, c3, l1, { cap: "ALTITUDE", val: t.alti !== "" && t.alti !== null ? `${t.alti} ft` : "", align: "center" });
  CELL(doc, x + 2 * c3, cy, w - 2 * c3, l1, { cap: "QFU", val: qfuTexte(t), align: "center", style: "bold" });
  cy += l1;

  const c4 = w / 4;
  CELL(doc, x, cy, c4, l1, { cap: "ATIS", val: t.atis || "", align: "center" });
  CELL(doc, x + c4, cy, c4, l1, { cap: "APP", val: t.app || "", align: "center" });
  CELL(doc, x + 2 * c4, cy, c4, l1, { cap: "TWR", val: t.twr || "", align: "center" });
  CELL(doc, x + 3 * c4, cy, w - 3 * c4, l1, { cap: "SOL", val: t.sol || "", align: "center" });
  cy += l1 + 1.2;

  // Observations saisies
  const obs = (t.obs || "").trim();
  const hObs = obs ? Math.max(7, doc.getTextDimensions(obs, { fontSize: 7.2, maxWidth: w - 4 }).h + 4.4) : 7;
  CELL(doc, x, cy, w, hObs, { cap: "OBSERVATIONS", val: "", fill: C.legFill });
  if (obs) T(doc, obs, x + 1.8, cy + 5.8, { size: 7.2, maxWidth: w - 3.6, color: C.encre });
  cy += hObs;

  return cy;
}

function qfuTexte(t) {
  const a = normalizeQfu(t.qfu1);
  const b = normalizeQfu(t.qfu2);
  return [a, b].filter(Boolean).join(" / ");
}

/** Grille ATIS entièrement vierge — à remplir en vol. */
function blocAtis(doc, x, y, w, titre, freq) {
  let cy = BANDE(doc, x, y, w, titre, {
    fill: C.bandeau2,
    droite: freq ? `${freq} MHz` : "fréq. ______",
  });

  const h = 8.4;
  const c2 = w / 2;
  const c3 = w / 3;

  CELL(doc, x, cy, c3, h, { cap: "INFO", val: "" });
  CELL(doc, x + c3, cy, c3, h, { cap: "PISTE", val: "" });
  CELL(doc, x + 2 * c3, cy, w - 2 * c3, h, { cap: "TRANSITION", val: "" });
  cy += h;

  CELL(doc, x, cy, c2, h, { cap: "VENT (° / kt)", val: "" });
  CELL(doc, x + c2, cy, w - c2, h, { cap: "VISIBILITÉ", val: "" });
  cy += h;

  CELL(doc, x, cy, c3, h, { cap: "QNH", val: "" });
  CELL(doc, x + c3, cy, c3, h, { cap: "QFE", val: "" });
  CELL(doc, x + 2 * c3, cy, w - 2 * c3, h, { cap: "PLAFOND", val: "" });
  cy += h;

  CELL(doc, x, cy, c3, h, { cap: "TEMP.", val: "" });
  CELL(doc, x + c3, cy, c3, h, { cap: "POINT DE ROSÉE", val: "" });
  CELL(doc, x + 2 * c3, cy, w - 2 * c3, h, { cap: "OBSERVATIONS", val: "" });
  cy += h;

  return cy;
}

/* ---------------------------------------------------------
   Tableau de navigation en quinconce
   --------------------------------------------------------- */

// Colonnes des points de report (rangée décalée à gauche)
const PT_COLS = [
  { key: "nom",   cap: "POINT DE REPORT", w: 64 },
  { key: "eto",   cap: "H. ESTIMÉE",      w: 22 },
  { key: "hre",   cap: "H. RÉELLE",       w: 24 },
  { key: "carb",  cap: "CARBU. RESTANT",  w: 24 },
  { key: "obs",   cap: "FRÉQUENCE / OBSERVATION", w: 50 },
];
const PT_X = PG.m;
const PT_DECALAGE_DROITE = 10;   // le bloc point s'arrête avant la marge droite

// Colonnes des branches (rangée décalée à droite)
const LG_COLS = [
  { key: "alt",  cap: "ALT / QNH", w: 22 },
  { key: "rm",   cap: "Rm",        w: 16 },
  { key: "cm",   cap: "Cm VENT",   w: 16 },
  { key: "dist", cap: "D (NM)",    w: 15 },
  { key: "cumD", cap: "CUM NM", w: 15 },
  { key: "vs",   cap: "Vs (kt)",   w: 14 },
  { key: "tsv",  cap: "Tsv",       w: 14 },
  { key: "t",    cap: "TEMPS",     w: 16 },
  { key: "cumT", cap: "CUM T.", w: 16 },
  { key: "notes", cap: "NOTES",    w: 26 },
];
const LG_DECALAGE = 24;          // décalage à droite des branches

const H_PT = 9;
const H_LG = 9.6;
const H_HEAD = 5;

function enteteNav(doc, y) {
  const wPt = PG.width - PT_DECALAGE_DROITE;
  const wLg = PG.width - LG_DECALAGE;

  // En-tête des points
  let x = PT_X;
  PT_COLS.forEach((c) => {
    BOX(doc, x, y, c.w, H_HEAD, { fill: C.bandeau, stroke: false });
    T(doc, c.cap, x + c.w / 2, y + H_HEAD - 1.6, { size: 5.4, style: "bold", color: C.blanc, align: "center", maxWidth: c.w - 1 });
    x += c.w;
  });
  T(doc, "POINTS", PT_X + wPt + 1.5, y + H_HEAD - 1.6, { size: 5.2, style: "bold", color: C.grisClair });

  // En-tête des branches, décalé
  let y2 = y + H_HEAD + 0.8;
  x = PG.m + LG_DECALAGE;
  LG_COLS.forEach((c) => {
    BOX(doc, x, y2, c.w, H_HEAD, { fill: C.bandeau2, stroke: false });
    T(doc, c.cap, x + c.w / 2, y2 + H_HEAD - 1.6, { size: 5.4, style: "bold", color: C.blanc, align: "center", maxWidth: c.w - 1 });
    x += c.w;
  });
  T(doc, "BRANCHES", PG.m + 1.5, y2 + H_HEAD - 1.6, { size: 5.2, style: "bold", color: C.grisClair });

  return y2 + H_HEAD + 1.2;
}

function rangeePoint(doc, y, p, index, total) {
  let x = PT_X;
  const terminus = index === 0 || index === total - 1;
  const fill = terminus ? C.pointFill : C.pointFill2;

  const valeurs = {
    nom: (p.nom || "").toUpperCase() || (index === 0 ? "DÉPART" : index === total - 1 ? "ARRIVÉE" : `POINT ${index + 1}`),
    eto: p.eto === null ? "" : fmtClock(p.eto),
    hre: "",     // laissé vierge : noté en vol
    carb: "",    // laissé vierge : noté en vol
    obs: p.obs || "",
  };

  PT_COLS.forEach((c) => {
    const estNom = c.key === "nom";
    CELL(doc, x, y, c.w, H_PT, {
      cap: null,
      val: valeurs[c.key],
      fill: estNom ? fill : (valeurs[c.key] === "" ? C.blanc : C.pointFill2),
      border: C.border,
      lw: 0.28,
      size: estNom ? 10 : 8.6,
      style: estNom ? "bold" : "normal",
      align: estNom ? "left" : "center",
    });
    x += c.w;
  });

  // Repère visuel : pastille du point sur la marge droite
  const cx = PT_X + PG.width - PT_DECALAGE_DROITE + 4.5;
  doc.setFillColor(C.bandeau[0], C.bandeau[1], C.bandeau[2]);
  doc.circle(cx, y + H_PT / 2, 1.5, "F");
  T(doc, String(index + 1), cx, y + H_PT / 2 + 1.05, { size: 5, style: "bold", color: C.blanc, align: "center" });

  return y + H_PT;
}

function rangeeBranche(doc, y, l, index) {
  let x = PG.m + LG_DECALAGE;

  const valeurs = {
    alt: l.altSaisie !== "" && l.altSaisie !== null && l.altSaisie !== undefined ? `${l.altSaisie} ft` : "",
    rm: l.rm === null ? "" : `${capRound(l.rm)}°`,
    cm: l.cm === null ? "" : `${capRound(l.cm)}°`,
    dist: l.dist === null ? "" : fmtNum(l.dist, l.dist % 1 === 0 ? 0 : 1),
    cumD: l.cumDist === null ? "" : fmtNum(l.cumDist, l.cumDist % 1 === 0 ? 0 : 1),
    vs: l.vs === null ? "" : String(Math.round(l.vs)),
    tsv: l.tsv === null ? "" : String(Math.round(l.tsv)),
    t: l.temps === null ? "" : String(Math.round(l.temps)),
    cumT: l.cumTime === null ? "" : fmtHMShort(l.cumTime),
    notes: l.notes || "",
  };

  // Numéro de branche dans la gouttière de gauche
  T(doc, `${index + 1}`, PG.m + LG_DECALAGE - 3, y + H_LG / 2 + 1.2, {
    size: 6.5, style: "bold", color: C.grisClair, align: "right",
  });

  LG_COLS.forEach((c) => {
    const cle = c.key;
    const vide = valeurs[cle] === "";
    CELL(doc, x, y, c.w, H_LG, {
      val: cle === "notes" ? "" : valeurs[cle],
      fill: vide ? C.blanc : C.legFill,
      border: C.borderFin,
      lw: 0.22,
      size: cle === "cm" || cle === "t" ? 9.5 : 8.4,
      style: cle === "cm" || cle === "t" ? "bold" : "normal",
      align: "center",
    });
    if (cle === "notes" && valeurs.notes) {
      const lignes = doc.splitTextToSize(valeurs.notes, c.w - 2.4).slice(0, 3);
      lignes.forEach((ln, i) => T(doc, ln, x + 1.2, y + 3.2 + i * 2.9, { size: 5.6, color: C.gris }));
    }
    x += c.w;
  });

  return y + H_LG;
}

/** Ligne de synthèse du tableau de navigation. */
function rangeeTotaux(doc, y, d) {
  const x = PG.m + LG_DECALAGE;
  const w = PG.width - LG_DECALAGE;
  BOX(doc, x, y, w, 7, { fill: C.pointFill, border: C.border, lw: 0.3 });

  let cx = x;
  const dec = {};
  LG_COLS.forEach((c) => { dec[c.key] = { x: cx, w: c.w }; cx += c.w; });

  T(doc, "TOTAUX", dec.alt.x + 2, y + 4.8, { size: 7.5, style: "bold", color: C.bandeau });
  if (d.totalDist > 0) {
    T(doc, `${fmtNum(d.totalDist, 1)} NM`, dec.cumD.x + dec.cumD.w / 2, y + 4.8, { size: 8.4, style: "bold", align: "center", color: C.bandeau });
    T(doc, `${Math.round(d.totalTsv)}`, dec.tsv.x + dec.tsv.w / 2, y + 4.8, { size: 8, align: "center", color: C.gris });
  }
  if (d.temps.trajet > 0) {
    T(doc, `${Math.round(d.temps.trajet)} mn`, dec.t.x + dec.t.w / 2, y + 4.8, { size: 8.4, style: "bold", align: "center", color: C.bandeau });
    T(doc, fmtHMShort(d.temps.trajet), dec.cumT.x + dec.cumT.w / 2, y + 4.8, { size: 8.4, style: "bold", align: "center", color: C.bandeau });
  }
  return y + 7;
}

/* ---------------------------------------------------------
   Bloc carburant / temps / masse (page de préparation)
   --------------------------------------------------------- */

function blocCarburant(doc, y, state, d) {
  let cy = BANDE(doc, PG.m, y, PG.width, "CARBURANT & TEMPS DE VOL", {
    droite: `${fuelLabel(state)}${d.fuel.densite ? "  ·  " + d.fuel.densite.toFixed(3) + " kg/L" : ""}${d.fuel.conso ? "  ·  " + fmtNum(d.fuel.conso, 1) + " L/h" : ""}`,
  });

  // Emport
  const hL = 8.4;
  const c5 = PG.width / 5;
  CELL(doc, PG.m, cy, c5, hL, { cap: "RÉSERVOIR G", val: state.carburant.tankG !== "" ? `${fmtNum(state.carburant.tankG, 1)} L` : "", align: "center" });
  CELL(doc, PG.m + c5, cy, c5, hL, { cap: "RÉSERVOIR C", val: state.carburant.tankC !== "" ? `${fmtNum(state.carburant.tankC, 1)} L` : "", align: "center" });
  CELL(doc, PG.m + 2 * c5, cy, c5, hL, { cap: "RÉSERVOIR P", val: state.carburant.tankP !== "" ? `${fmtNum(state.carburant.tankP, 1)} L` : "", align: "center" });
  CELL(doc, PG.m + 3 * c5, cy, c5, hL, {
    cap: "TOTAL EMBARQUÉ", val: d.fuel.aBord === null ? "" : `${fmtNum(d.fuel.aBord, 1)} L`,
    align: "center", style: "bold", fill: C.pointFill2,
  });
  CELL(doc, PG.m + 4 * c5, cy, PG.width - 4 * c5, hL, {
    cap: "MASSE CARBURANT", val: d.fuel.masseCarb === null ? "" : `${fmtNum(d.fuel.masseCarb, 1)} kg`,
    align: "center", style: "bold", fill: C.pointFill2,
  });
  cy += hL + 1.5;

  // Tableau des phases
  const colw = [58, 24, 24, 30, PG.width - 58 - 24 - 24 - 30];
  const cap = ["PÉRIODE DU VOL", "DURÉE", "CUMUL", "CARBURANT", "RELEVÉ RÉEL EN VOL"];
  let x = PG.m;
  cap.forEach((c, i) => {
    BOX(doc, x, cy, colw[i], H_HEAD, { fill: C.bandeau2, stroke: false });
    T(doc, c, x + colw[i] / 2, cy + H_HEAD - 1.5, { size: 5.4, style: "bold", color: C.blanc, align: "center" });
    x += colw[i];
  });
  cy += H_HEAD;

  let cumul = 0;
  const hR = 7;
  PHASES.forEach((p, idx) => {
    const minutes = d.temps[p.key] || 0;
    cumul += minutes;
    const fuel = d.fuel.perPhase[p.key];
    x = PG.m;
    const vals = [
      p.label,
      minutes ? `${Math.round(minutes)} mn` : "",
      minutes ? fmtHM(minutes === 0 ? 0 : cumul, { vide: "" }) : "",
      fuel === null || !minutes ? "" : `${fmtNum(fuel, 1)} L`,
      "",
    ];
    vals.forEach((v, i) => {
      CELL(doc, x, cy, colw[i], hR, {
        val: v,
        fill: idx % 2 ? C.legFill : C.blanc,
        border: C.borderFin,
        align: i === 0 ? "left" : "center",
        size: 8,
      });
      x += colw[i];
    });
    cy += hR;
  });

  // Total
  x = PG.m;
  const totaux = [
    "TOTAL",
    `${Math.round(d.temps.total)} mn`,
    fmtHM(d.temps.total, { vide: "" }),
    d.fuel.total === null ? "" : `${fmtNum(d.fuel.total, 1)} L`,
    "",
  ];
  totaux.forEach((v, i) => {
    CELL(doc, x, cy, colw[i], hR + 0.6, {
      val: v, fill: C.pointFill, border: C.border, lw: 0.3,
      align: i === 0 ? "left" : "center", size: 8.6, style: "bold", color: C.bandeau,
    });
    x += colw[i];
  });
  cy += hR + 0.6 + 1.5;

  // Bilan
  const c4 = PG.width / 4;
  const marge = d.fuel.restantL;
  CELL(doc, PG.m, cy, c4, hL, { cap: "AUTONOMIE", val: d.fuel.autonomie === null ? "" : fmtHM(d.fuel.autonomie, { vide: "" }), align: "center", style: "bold" });
  CELL(doc, PG.m + c4, cy, c4, hL, { cap: "NÉCESSAIRE", val: d.fuel.total === null ? "" : `${fmtNum(d.fuel.total, 1)} L`, align: "center" });
  CELL(doc, PG.m + 2 * c4, cy, c4, hL, {
    cap: "MARGE / EMPORT", val: marge === null ? "" : `${marge >= 0 ? "+" : "-"}${fmtNum(Math.abs(marge), 1)} L`,
    align: "center", style: "bold",
    color: marge !== null && marge < 0 ? C.alerte : C.vert,
    fill: marge !== null && marge < 0 ? [253, 236, 236] : C.blanc,
  });
  CELL(doc, PG.m + 3 * c4, cy, PG.width - 3 * c4, hL, {
    cap: "RESTANT À L'ARRIVÉE (ESTIMÉ)",
    val: d.fuel.restantApresVol === null ? "" : `${fmtNum(d.fuel.restantApresVol, 1)} L`,
    align: "center",
  });
  cy += hL;

  const obs = (state.carburant.obs || "").trim();
  if (obs) {
    CELL(doc, PG.m, cy, PG.width, 8, { cap: "OBSERVATIONS CARBURANT", val: "", fill: C.legFill });
    T(doc, obs, PG.m + 1.8, cy + 6.2, { size: 7.2, maxWidth: PG.width - 4 });
    cy += 8;
  }
  return cy;
}

function blocMasse(doc, x, y, w, state, d) {
  let cy = BANDE(doc, x, y, w, "MASSE AU DÉCOLLAGE", {
    droite: d.masse.mtow ? `MTOW ${fmtNum(d.masse.mtow, 0)} kg` : "",
  });
  const h = 7;
  const lignes = [
    ["Masse à vide équipée", d.masse.vide],
    ["Équipage", d.masse.equipage],
    ["Passagers", d.masse.pax],
    ["Bagages", d.masse.bagages],
    [`Carburant (${d.fuel.aBord === null ? "—" : fmtNum(d.fuel.aBord, 0)} L)`, d.masse.carburant],
  ];
  lignes.forEach(([label, val], i) => {
    CELL(doc, x, cy, w * 0.62, h, { val: label, fill: i % 2 ? C.legFill : C.blanc, border: C.borderFin, size: 8 });
    CELL(doc, x + w * 0.62, cy, w * 0.38, h, {
      val: val === null || val === undefined ? "" : `${fmtNum(val, 1)} kg`,
      fill: i % 2 ? C.legFill : C.blanc, border: C.borderFin, align: "right", size: 8,
    });
    cy += h;
  });
  CELL(doc, x, cy, w * 0.62, h + 0.6, { val: "MASSE TOTALE", fill: C.pointFill, border: C.border, lw: 0.3, size: 8.6, style: "bold", color: C.bandeau });
  CELL(doc, x + w * 0.62, cy, w * 0.38, h + 0.6, {
    val: d.masse.total === null ? "" : `${fmtNum(d.masse.total, 1)} kg`,
    fill: C.pointFill, border: C.border, lw: 0.3, align: "right", size: 8.6, style: "bold", color: C.bandeau,
  });
  cy += h + 0.6;

  const marge = d.masse.marge;
  CELL(doc, x, cy, w * 0.62, h, { val: "Marge / MTOW", border: C.borderFin, size: 8 });
  CELL(doc, x + w * 0.62, cy, w * 0.38, h, {
    val: marge === null ? "" : `${marge >= 0 ? "+" : "-"}${fmtNum(Math.abs(marge), 1)} kg`,
    border: C.borderFin, align: "right", size: 8.4, style: "bold",
    color: marge !== null && marge < 0 ? C.alerte : C.vert,
    fill: marge !== null && marge < 0 ? [253, 236, 236] : C.blanc,
  });
  return cy + h;
}

function blocHeures(doc, x, y, w, state) {
  let cy = BANDE(doc, x, y, w, "HEURES & RELEVÉS  —  à compléter en vol", { fill: C.bandeau2 });
  const h = 9;
  const c2 = w / 2;
  const paires = [
    ["HEURE MOTEUR DÉPART", "HEURE MOTEUR ARRIVÉE"],
    ["DÉPART BLOC", "ARRIVÉE BLOC"],
    ["DÉCOLLAGE", "ATTERRISSAGE"],
    ["TEMPS MOTEUR", "TEMPS DE VOL"],
    ["CARBURANT AVANT", "CARBURANT APRÈS"],
  ];
  paires.forEach(([a, b]) => {
    CELL(doc, x, cy, c2, h, { cap: a, val: "" });
    CELL(doc, x + c2, cy, w - c2, h, { cap: b, val: "" });
    cy += h;
  });
  return cy;
}

function blocNotes(doc, y, titre, texte, nbLignesVierges, largeur) {
  const w = largeur || PG.width;
  let cy = BANDE(doc, PG.m, y, w, titre);
  const t = (texte || "").trim();
  let hTexte = 0;
  if (t) {
    const lignes = doc.splitTextToSize(t, w - 5);
    hTexte = lignes.length * 3.7 + 3;
    BOX(doc, PG.m, cy, w, hTexte, { fill: C.legFill, border: C.borderFin });
    lignes.forEach((ln, i) => T(doc, ln, PG.m + 2.5, cy + 4.4 + i * 3.7, { size: 7.6 }));
    cy += hTexte;
  }
  if (nbLignesVierges > 0) {
    const h = nbLignesVierges * 5.2 + 1;
    BOX(doc, PG.m, cy, w, h, { border: C.borderFin });
    LIGNES(doc, PG.m + 2, cy - 0.5, w - 4, nbLignesVierges - 1);
    cy += h;
  }
  return cy;
}

/* ---------------------------------------------------------
   Assemblage
   --------------------------------------------------------- */

function piedDePage(doc, state) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(C.borderFin[0], C.borderFin[1], C.borderFin[2]);
    doc.setLineWidth(0.15);
    doc.line(PG.m, PG.h - 8.5, PG.right, PG.h - 8.5);
    const route = [state.dep.icao, state.arr.icao].filter(Boolean).join(" » ");
    T(doc, `Log de nav ${route}${state.meta.date ? "  ·  " + formaterDate(state.meta.date) : ""}`, PG.m, PG.h - 5.5, { size: 6.5, color: C.grisClair });
    T(doc, "Document d'aide à la préparation — ne remplace pas la documentation officielle", PG.w / 2, PG.h - 5.5, { size: 6.5, color: C.grisClair, align: "center" });
    T(doc, `Page ${i} / ${total}`, PG.right, PG.h - 5.5, { size: 6.5, color: C.grisClair, align: "right" });
  }
}

function nouvellePage(doc, state, titre) {
  doc.addPage();
  const y = PG.top;
  BOX(doc, PG.m, y, PG.width, 8, { fill: C.bandeau, stroke: false });
  const route = [state.dep.icao, state.arr.icao].filter(Boolean).join("  »  ").toUpperCase();
  T(doc, titre, PG.m + 3, y + 5.5, { size: 8, style: "bold", color: C.blanc });
  T(doc, `${route}${state.avion.immat ? "   ·   " + state.avion.immat.toUpperCase() : ""}`, PG.right - 3, y + 5.5, {
    size: 8, style: "bold", color: [180, 208, 232], align: "right",
  });
  return y + 8 + 3;
}

function buildPdf(state, d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setLineHeightFactor(1.25);

  /* ---- Page 1 : le log de nav ---- */
  let y = bandeauTitre(doc, state, d);
  doc.__y = y;
  bandeauInfos(doc, state, d);
  y = doc.__y;

  const demiL = (PG.width - 4) / 2;
  const yDepA = blocTerrain(doc, PG.m, y, demiL, "TERRAIN DE DÉPART", state.dep);
  const yDepB = blocAtis(doc, PG.m + demiL + 4, y, demiL, "ATIS DÉPART", state.dep.atis);
  y = Math.max(yDepA, yDepB) + 3.5;

  // Tableau de navigation (paginé)
  const points = d.points;
  const legs = d.legs.map((l, i) => ({ ...l, altSaisie: state.legs[i] ? state.legs[i].alt : "" }));

  const hBlocArrivee = 42;
  let i = 0;
  let premierePage = true;

  while (i < points.length) {
    if (!premierePage) y = nouvellePage(doc, state, "LOG DE NAVIGATION (suite)");
    y = enteteNav(doc, y);

    // Place disponible : sur la dernière fournée, on réserve le bloc arrivée
    let limite = PG.h - PG.bottom - 2;
    while (i < points.length) {
      const dernier = i === points.length - 1;
      const besoin = H_PT + (dernier ? 8 : H_LG);
      const reserve = dernier ? hBlocArrivee + 4 : 0;
      if (y + besoin + reserve > limite) {
        if (dernier && y + besoin <= limite) {
          // le dernier point tient, seul le bloc arrivée passe à la page suivante
        } else break;
      }
      y = rangeePoint(doc, y, points[i], i, points.length);
      if (!dernier && legs[i]) y = rangeeBranche(doc, y, legs[i], i);
      i++;
    }

    if (i >= points.length) y = rangeeTotaux(doc, y, d) + 4;
    premierePage = false;
  }

  // Bloc arrivée (nouvelle page si nécessaire)
  if (y + hBlocArrivee > PG.h - PG.bottom - 2) y = nouvellePage(doc, state, "ARRIVÉE");
  const yArrA = blocTerrain(doc, PG.m, y, demiL, "TERRAIN D'ARRIVÉE", state.arr, { fill: C.bandeau });
  const yArrB = blocAtis(doc, PG.m + demiL + 4, y, demiL, "ATIS ARRIVÉE", state.arr.atis);
  y = Math.max(yArrA, yArrB);

  // Dégagement si renseigné
  if (state.deg.icao) {
    y += 2.5;
    if (y + 14 > PG.h - PG.bottom) y = nouvellePage(doc, state, "DÉGAGEMENT");
    BANDE(doc, PG.m, y, PG.width, "TERRAIN DE DÉGAGEMENT");
    const c4 = PG.width / 4;
    const hy = y + 5.4;
    CELL(doc, PG.m, hy, c4, 8.4, { cap: "TERRAIN", val: state.deg.icao.toUpperCase(), style: "bold" });
    CELL(doc, PG.m + c4, hy, c4, 8.4, { cap: "DISTANCE", val: state.deg.dist !== "" ? `${state.deg.dist} NM` : "", align: "center" });
    CELL(doc, PG.m + 2 * c4, hy, c4, 8.4, { cap: "FRÉQUENCE", val: state.deg.freq || "", align: "center" });
    CELL(doc, PG.m + 3 * c4, hy, PG.width - 3 * c4, 8.4, { cap: "ALTITUDE", val: state.deg.alti !== "" ? `${state.deg.alti} ft` : "", align: "center" });
    y = hy + 8.4;
  }

  /* ---- Préparation : carburant, masse, briefing ---- */
  // Si la page courante offre assez de place, on y place le bloc carburant
  if (PG.h - PG.bottom - y > 102) {
    y = blocCarburant(doc, y + 4, state, d) + 3.5;
  } else {
    y = nouvellePage(doc, state, "PRÉPARATION — CARBURANT, MASSE & BRIEFING");
    y = blocCarburant(doc, y, state, d) + 3.5;
  }

  if (PG.h - PG.bottom - y < 60) y = nouvellePage(doc, state, "PRÉPARATION — MASSE & BRIEFING");

  const yM = blocMasse(doc, PG.m, y, demiL, state, d);
  const yH = blocHeures(doc, PG.m + demiL + 4, y, demiL, state);
  y = Math.max(yM, yH) + 3.5;

  // Caractéristiques avion
  if (PG.h - PG.bottom - y < 20) y = nouvellePage(doc, state, "PRÉPARATION (suite)");
  BANDE(doc, PG.m, y, PG.width, "AVION", { fill: C.bandeau2, droite: [state.avion.type, state.avion.immat].filter(Boolean).join("  ·  ").toUpperCase() });
  y += 5.4;
  const c6 = PG.width / 6;
  const infos = [
    ["VP / VCR", state.avion.vcr ? `${state.avion.vcr} kt` : ""],
    ["MTOW", state.avion.mtow ? `${state.avion.mtow} kg` : ""],
    ["MASSE À VIDE", state.avion.masseVide ? `${state.avion.masseVide} kg` : ""],
    ["CAPACITÉ", state.avion.capacite ? `${state.avion.capacite} L` : ""],
    ["PLAFOND", state.avion.altitudeMax ? `${state.avion.altitudeMax} ft` : ""],
    ["PLACES PAX", state.avion.nbPax !== "" ? String(state.avion.nbPax) : ""],
  ];
  infos.forEach((inf, k) => {
    CELL(doc, PG.m + k * c6, y, k === 5 ? PG.width - 5 * c6 : c6, 8.4, {
      cap: inf[0], val: inf[1], align: "center", style: "bold",
    });
  });
  y += 8.4 + 3.5;

  // Notes — dimensionnées pour tenir sur la page
  if (PG.h - PG.bottom - y < 34) y = nouvellePage(doc, state, "NOTES & BRIEFING");
  let reste = PG.h - PG.bottom - y;
  const hTexte = (t) => (t || "").trim() ? doc.splitTextToSize((t || "").trim(), PG.width - 5).length * 3.7 + 3 : 0;

  const hBriefing = 5.4 + hTexte(state.notes);
  const hArrivee = 5.4 + hTexte(state.arr.notes);
  // Répartit les lignes vierges restantes entre briefing, arrivée et notes en vol
  let libre = Math.max(0, reste - hBriefing - hArrivee - 12);
  const lBrief = Math.max(2, Math.min(8, Math.floor(libre * 0.35 / 5.2)));
  const lArr = Math.max(2, Math.min(5, Math.floor(libre * 0.2 / 5.2)));

  y = blocNotes(doc, y, "NOTES & BRIEFING", state.notes, lBrief) + 3;
  y = blocNotes(doc, y, "NOTES D'ARRIVÉE / FINALE", state.arr.notes, lArr) + 3;

  reste = PG.h - PG.bottom - y;
  if (reste > 20) {
    blocNotes(doc, y, "NOTES EN VOL", "", Math.max(2, Math.floor((reste - 7) / 5.2)));
  }

  piedDePage(doc, state);

  const nom = [state.dep.icao, state.arr.icao].filter(Boolean).join("-") || "lognav";
  doc.save(`log-nav-${nom}${state.meta.date ? "-" + state.meta.date : ""}.pdf`);
}
