/* =========================================================
   app.js — interface, liaison des champs, rendu, événements
   ========================================================= */

let state = defaultState();
let derived = computeAll(state);
let saveTimer = null;

/* ---------------------------------------------------------
   Utilitaires DOM
   --------------------------------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

/** Crée une icône SVG (namespace correct + xlink:href pour les anciens WebKit). */
function iconeSvg(ref, classe = "icon") {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", classe);
  const use = document.createElementNS(NS, "use");
  use.setAttribute("href", ref);
  use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", ref);
  svg.appendChild(use);
  return svg;
}

/** Safari < 14.1 ignore « gap » en flexbox : on le détecte pour activer le repli CSS. */
function detecterFlexGap() {
  const test = document.createElement("div");
  test.style.cssText = "display:flex;flex-direction:column;gap:1px;position:absolute;visibility:hidden";
  test.appendChild(document.createElement("div"));
  test.appendChild(document.createElement("div"));
  document.body.appendChild(test);
  const supporte = test.scrollHeight === 1;
  test.remove();
  if (!supporte) document.documentElement.classList.add("no-flex-gap");
  return supporte;
}

function toast(message, type = "ok") {
  const zone = $("#toast-zone");
  if (!zone) return;
  const t = el("div", { class: `toast ${type}`, text: message });
  zone.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity .3s ease, transform .3s ease";
    t.style.opacity = "0";
    t.style.transform = "translateY(8px)";
    setTimeout(() => t.remove(), 320);
  }, 2600);
}

/* ---------------------------------------------------------
   Sauvegarde automatique
   --------------------------------------------------------- */

function scheduleSave() {
  const box = $("#save-state");
  const txt = $("#save-text");
  if (box) box.classList.add("saving");
  if (txt) txt.textContent = "Enregistrement…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const ok = Store.save(state);
    if (box) box.classList.remove("saving");
    if (txt) txt.textContent = ok ? "Sauvegardé" : "Sauvegarde indisponible";
  }, 400);
}

/* ---------------------------------------------------------
   Liaison des champs statiques (data-path)
   --------------------------------------------------------- */

function valueToInput(input, value) {
  if (input.type === "radio") input.checked = String(value) === input.value;
  else if (input.type === "checkbox") input.checked = Boolean(value);
  else input.value = value === null || value === undefined ? "" : value;
}

function bindStaticInputs() {
  $$("[data-path]").forEach((input) => {
    const path = input.dataset.path;
    input.addEventListener("input", () => {
      let v = input.type === "checkbox" ? input.checked : input.value;
      setPath(state, path, v);
      onFieldChange(path, input);
    });
    if (input.type === "radio") {
      input.addEventListener("change", () => {
        if (input.checked) { setPath(state, path, input.value); onFieldChange(path, input); }
      });
    }
  });
}

function fillStaticInputs() {
  $$("[data-path]").forEach((input) => valueToInput(input, getPath(state, input.dataset.path)));
}

/** Réactions particulières à la modification d'un champ. */
function onFieldChange(path, input) {
  if (path === "carburant.type") appliquerCarburant(input.value);
  if (path === "nav.modeRoute") renderTimeline();
  if (path === "dep.icao" || path === "arr.icao") syncTerminus(true);
  if (path === "dep.qfu1") majQfu("dep", 1);
  if (path === "dep.qfu2") majQfu("dep", 2);
  if (path === "arr.qfu1") majQfu("arr", 1);
  if (path === "arr.qfu2") majQfu("arr", 2);
  refresh();
}

/** QFU : normalise la piste saisie et calcule la réciproque. */
function majQfu(terrain, which) {
  const a = $(`#qfu_${terrain}1`);
  const b = $(`#qfu_${terrain}2`);
  if (!a || !b) return;
  const src = which === 1 ? a : b;
  const dst = which === 1 ? b : a;
  const norm = normalizeQfu(src.value);
  if (!norm) return;
  if (document.activeElement !== dst) {
    dst.value = reciprocalQfu(norm);
    setPath(state, `${terrain}.qfu${which === 1 ? 2 : 1}`, dst.value);
  }
}

/** Normalise les QFU à la sortie du champ. */
function normaliserQfuOnBlur() {
  ["dep", "arr"].forEach((t) => {
    [1, 2].forEach((i) => {
      const input = $(`#qfu_${t}${i}`);
      if (!input) return;
      input.addEventListener("blur", () => {
        const n = normalizeQfu(input.value);
        if (n) { input.value = n; setPath(state, `${t}.qfu${i}`, n); refresh(); }
      });
    });
  });
}

/* ---------------------------------------------------------
   Carburant : liste déroulante + densité
   --------------------------------------------------------- */

function remplirListeCarburants() {
  const sel = $("#select-carburant");
  if (!sel) return;
  sel.innerHTML = "";
  FUELS.forEach((f) => {
    sel.appendChild(el("option", {
      value: f.id,
      text: f.densite ? `${f.label} — ${f.densite.toFixed(3)} kg/L` : f.label,
    }));
  });
  sel.value = state.carburant.type;
}

function appliquerCarburant(id) {
  const f = FUELS.find((x) => x.id === id);
  const input = $("#input-densite");
  if (!f) return;
  if (f.densite) {
    state.carburant.densite = f.densite;
    if (input) { input.value = f.densite; input.readOnly = false; }
  } else if (input) {
    input.focus();
    input.select();
  }
}

/* ---------------------------------------------------------
   Profils avion
   --------------------------------------------------------- */

function remplirPresetsAvion() {
  const sel = $("#preset-avion");
  if (!sel) return;
  const filtre = Boolean(state.avion.filtreXp12);
  sel.innerHTML = "";
  sel.appendChild(el("option", { value: "", text: "— Saisie manuelle —" }));

  let total = 0;
  GROUPES_AVION.forEach((g) => {
    const liste = AIRCRAFT_PRESETS.filter((a) => a.groupe === g.id && (!filtre || a.xp12));
    if (!liste.length) return;
    const groupe = el("optgroup", { label: g.label });
    liste.forEach((a) => {
      groupe.appendChild(el("option", {
        value: a.id,
        text: a.label + (a.xp12 && !filtre ? "  ·  XP12" : ""),
      }));
      total++;
    });
    sel.appendChild(groupe);
  });

  const bouton = $("#filtre-xp12");
  if (bouton) {
    bouton.classList.toggle("actif", filtre);
    bouton.setAttribute("aria-pressed", filtre ? "true" : "false");
    bouton.title = filtre
      ? `Flotte X-Plane 12 uniquement (${total} appareils) — cliquer pour tout afficher`
      : `Afficher uniquement la flotte par défaut de X-Plane 12`;
  }

  // Conserve la sélection si elle existe toujours dans la liste filtrée
  sel.value = AIRCRAFT_PRESETS.some((a) => a.id === state.avion.preset && (!filtre || a.xp12))
    ? state.avion.preset
    : "";
}

function remplirProfilsAvion() {
  const sel = $("#profil-avion");
  if (!sel) return;
  const courant = sel.value;
  sel.innerHTML = "";
  sel.appendChild(el("option", { value: "", text: "— Aucun —" }));
  Store.profils().forEach((p) => sel.appendChild(el("option", { value: p.id, text: p.label })));
  sel.value = courant;
}

function appliquerAvion(a) {
  if (!a) return;
  state.avion.type = a.type !== undefined ? a.type : a.label;
  state.avion.vcr = a.vcr ?? "";
  state.avion.mtow = a.mtow ?? "";
  state.avion.masseVide = a.masseVide ?? "";
  state.avion.capacite = a.capacite ?? "";
  state.avion.altitudeMax = a.altitudeMax ?? "";
  state.avion.nbPax = a.nbPax ?? "";
  if (a.immat) state.avion.immat = a.immat;
  if (a.conso) state.carburant.conso = a.conso;
  if (a.carburant) {
    state.carburant.type = a.carburant;
    const f = FUELS.find((x) => x.id === a.carburant);
    if (f && f.densite) state.carburant.densite = f.densite;
  }
  if (a.densite) state.carburant.densite = a.densite;
  fillStaticInputs();
  refresh();
}

/* ---------------------------------------------------------
   Points de report et branches (quinconce)
   --------------------------------------------------------- */

function champ(labelText, input, extraClass = "") {
  return el("label", { class: `field ${extraClass}` }, [el("span", { text: labelText }), input]);
}

function sortie(labelText, key, extraClass = "") {
  return el("div", { class: `field ${extraClass}` }, [
    el("span", { text: labelText }),
    el("div", { class: "readonly-out", "data-out": key, text: "—" }),
  ]);
}

function inputNum(value, onInput, opts = {}) {
  const i = el("input", {
    type: "number",
    step: opts.step || "1",
    min: opts.min,
    max: opts.max,
    placeholder: opts.placeholder || "",
    title: opts.title,
  });
  i.value = value === null || value === undefined ? "" : value;
  i.addEventListener("input", onInput);
  return i;
}

function inputTexte(value, onInput, opts = {}) {
  const i = el("input", { type: "text", placeholder: opts.placeholder || "", class: opts.class });
  i.value = value || "";
  i.addEventListener("input", onInput);
  return i;
}

function renderTimeline() {
  const tl = $("#timeline");
  if (!tl) return;
  tl.innerHTML = "";

  state.points.forEach((point, i) => {
    const dernier = i === state.points.length - 1;
    const terminus = i === 0 || dernier;

    /* --- Carte point de report --- */
    const row = el("div", { class: `tl-row wp${terminus ? " terminus" : ""}` });
    const nameInput = inputTexte(point.nom, (e) => {
      point.nom = e.target.value.toUpperCase();
      e.target.value = point.nom;
      point.auto = false;
      refresh();
    }, { placeholder: terminus ? (i === 0 ? "Terrain de départ" : "Terrain d'arrivée") : "Point de report", class: "wp-name-input" });

    const tools = el("div", { class: "wp-tools" });
    if (!terminus) {
      tools.appendChild(el("button", {
        type: "button", class: "tiny", title: "Monter ce point",
        text: "↑", onclick: () => deplacerPoint(i, -1),
      }));
      tools.appendChild(el("button", {
        type: "button", class: "tiny", title: "Descendre ce point",
        text: "↓", onclick: () => deplacerPoint(i, 1),
      }));
      tools.appendChild(el("button", {
        type: "button", class: "tiny danger", title: "Supprimer ce point",
        text: "×", onclick: () => supprimerPoint(i),
      }));
    } else {
      tools.appendChild(el("span", { class: "wp-tag", text: i === 0 ? "Départ" : "Arrivée" }));
    }

    const card = el("div", { class: "wp-card" }, [
      champ(`Point ${i + 1}`, nameInput),
      sortie("Heure esti.", `point.${i}.eto`),
      sortie("Cumul", `point.${i}.cum`),
      champ("Fréquence / observation", inputTexte(point.obs, (e) => { point.obs = e.target.value; scheduleSave(); }, { placeholder: "ex : contact TWR 118.7" })),
      tools,
    ]);
    row.appendChild(card);
    tl.appendChild(row);

    /* --- Carte branche (décalée) --- */
    if (dernier) return;
    const leg = state.legs[i];
    if (!leg) return;

    const suivant = state.points[i + 1];
    const head = el("div", { class: "leg-head" }, [
      el("span", { text: `Branche ${i + 1}` }),
      el("span", {
        class: "seg-arrow",
        text: `${point.nom || "point " + (i + 1)}  ▸  ${suivant.nom || "point " + (i + 2)}`,
      }),
    ]);

    const legCard = el("div", { class: "leg-card" }, [
      head,
      champ("Alt QNH (ft)", inputNum(leg.alt, (e) => { leg.alt = e.target.value; refresh(); }, { step: "50", min: "0", placeholder: "2500" })),
      champ(state.nav.modeRoute === "rm" ? "Rm (°)" : "Rv (°)", inputNum(leg.route, (e) => { leg.route = e.target.value; refresh(); }, { min: "0", max: "360", placeholder: "090" })),
      champ("Dist (NM)", inputNum(leg.dist, (e) => { leg.dist = e.target.value; refresh(); }, { step: "0.1", min: "0", placeholder: "24" })),
      champ("Vp (kt)", inputNum(leg.vp, (e) => { leg.vp = e.target.value; refresh(); }, { min: "0", placeholder: state.avion.vcr || "auto", title: "Vitesse propre sur cette branche (vide = VCR de l'avion)" })),
      champ("Vent (°)", inputNum(leg.ventDir, (e) => { leg.ventDir = e.target.value; refresh(); }, { min: "0", max: "360", step: "5", placeholder: state.nav.ventDir || "gén.", title: "Vent local sur cette branche (vide = vent général)" })),
      champ("Vent (kt)", inputNum(leg.ventVit, (e) => { leg.ventVit = e.target.value; refresh(); }, { min: "0", placeholder: state.nav.ventVit || "gén." })),
      sortie("Rm", `leg.${i}.rm`),
      sortie("Cm vent", `leg.${i}.cm`),
      sortie("Vs", `leg.${i}.vs`),
      sortie("Tsv", `leg.${i}.tsv`),
      champ("Temps (mn)", inputNum(leg.tman, (e) => { leg.tman = e.target.value; refresh(); }, { min: "0", placeholder: "auto", title: "Laisser vide pour le temps calculé avec le vent" })),
      sortie("Cumul", `leg.${i}.cum`),
      champ("Notes de branche", inputTexte(leg.notes, (e) => { leg.notes = e.target.value; scheduleSave(); }, { placeholder: "espace aérien, repère, altitude de sécurité…" }), "wide"),
    ]);

    tl.appendChild(el("div", { class: "tl-row" }, [el("div", { class: "leg-wrap" }, [legCard])]));
  });

  // Entrée dans le dernier champ = nouveau point
  const inputs = $$("#timeline input");
  const last = inputs[inputs.length - 1];
  if (last) {
    last.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); ajouterPoint(); }
    });
  }
}

function ajouterPoint() {
  // Insère un point avant le terrain d'arrivée
  const idx = Math.max(1, state.points.length - 1);
  state.points.splice(idx, 0, newPoint());
  state.legs.splice(idx - 1, 0, newLeg());
  renderTimeline();
  refresh();
  const cartes = $$("#timeline .wp-card .wp-name-input");
  if (cartes[idx]) cartes[idx].focus();
}

function supprimerPoint(i) {
  if (state.points.length <= 2) return;
  state.points.splice(i, 1);
  state.legs.splice(Math.max(0, i - 1), 1);
  renderTimeline();
  refresh();
}

function deplacerPoint(i, delta) {
  const j = i + delta;
  if (j < 1 || j > state.points.length - 2) return;
  const [p] = state.points.splice(i, 1);
  state.points.splice(j, 0, p);
  renderTimeline();
  refresh();
}

/** Inverse le sens du trajet (préparation du vol retour). */
function inverserTrajet() {
  state.points.reverse();
  state.legs.reverse();
  state.legs.forEach((leg) => {
    const r = num(leg.route);
    if (r !== null) leg.route = capRound(r + 180);
  });
  // Échange départ / arrivée
  const dep = { ...state.dep };
  const arr = { ...state.arr };
  state.dep = { ...state.dep, icao: arr.icao, qfu1: arr.qfu1, qfu2: arr.qfu2, alti: arr.alti, app: arr.app, twr: arr.twr, sol: arr.sol, atis: arr.atis, obs: arr.obs };
  state.arr = { ...state.arr, icao: dep.icao, qfu1: dep.qfu1, qfu2: dep.qfu2, alti: dep.alti, app: dep.app, twr: dep.twr, sol: dep.sol, atis: dep.atis, obs: dep.obs };
  fillStaticInputs();
  renderTimeline();
  refresh();
  toast("Trajet inversé");
}

/** Recopie le nom des terrains sur le premier et le dernier point. */
function syncTerminus(forcerDom) {
  const maj = (idx, icao) => {
    const p = state.points[idx];
    if (!p) return;
    if (p.auto !== false || !p.nom) {
      const v = (icao || "").toUpperCase();
      if (p.nom !== v) {
        p.nom = v;
        p.auto = true;
        if (forcerDom) {
          const inputs = $$("#timeline .wp-name-input");
          if (inputs[idx] && document.activeElement !== inputs[idx]) inputs[idx].value = v;
        }
      }
    }
  };
  maj(0, state.dep.icao);
  maj(state.points.length - 1, state.arr.icao);
}

/* ---------------------------------------------------------
   Tableau des phases
   --------------------------------------------------------- */

function renderPhases() {
  const body = $("#phase-body");
  if (!body) return;
  body.innerHTML = "";

  PHASES.forEach((p) => {
    const auto =
      (p.key === "trajet" && state.temps.trajetAuto) ||
      (p.key === "resVent" && state.temps.resVentAuto);

    const input = inputNum(auto ? "" : state.temps[p.key], (e) => {
      state.temps[p.key] = e.target.value;
      refresh();
    }, { min: "0", step: "1" });
    input.disabled = auto;
    input.dataset.phase = p.key;

    const tr = el("tr", { class: auto ? "auto-row" : "" }, [
      el("td", { class: "label" }, [
        el("span", { text: p.label }),
        el("span", { class: "sub", text: p.sub }),
      ]),
      el("td", { class: "num cell-time" }, [input]),
      el("td", { class: "num" }, [el("span", { class: "out", "data-out": `phase.${p.key}.cum`, text: "—" })]),
      el("td", { class: "num" }, [el("span", { class: "out", "data-out": `phase.${p.key}.fuel`, text: "—" })]),
      el("td", {}, [outilPhase(p)]),
    ]);
    body.appendChild(tr);
  });

  const tr = el("tr", { class: "total" }, [
    el("td", { class: "label", text: "TOTAL" }),
    el("td", { class: "num" }, [el("span", { class: "out", "data-out": "phase.total.temps", text: "—" })]),
    el("td", {}),
    el("td", { class: "num" }, [el("span", { class: "out", "data-out": "phase.total.fuel", text: "—" })]),
    el("td", {}),
  ]);
  body.appendChild(tr);
}

function outilPhase(p) {
  if (p.key === "trajet") return interrupteur("Auto (nav)", state.temps.trajetAuto, (v) => {
    state.temps.trajetAuto = v;
    if (!v) state.temps.trajet = Math.round(derived.temps.trajet);
    renderPhases(); refresh();
  });
  if (p.key === "resVent") return interrupteur("10 % trajet", state.temps.resVentAuto, (v) => {
    state.temps.resVentAuto = v;
    if (!v) state.temps.resVent = Math.round(derived.temps.resVent);
    renderPhases(); refresh();
  });
  if (p.key === "resObl") {
    const wrap = el("div", { style: "display:flex;gap:4px" });
    [["Jour 30", 30], ["Nuit 45", 45]].forEach(([txt, val]) => {
      wrap.appendChild(el("button", {
        type: "button", class: "tiny", text: txt,
        onclick: () => { state.temps.resObl = val; renderPhases(); refresh(); },
      }));
    });
    return wrap;
  }
  return el("span");
}

function interrupteur(labelText, checked, onChange) {
  const input = el("input", { type: "checkbox" });
  input.checked = Boolean(checked);
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "switch", title: labelText }, [input, el("span", { class: "track" }), el("span", { class: "switch-label", text: labelText })]);
}

/* ---------------------------------------------------------
   Rafraîchissement des valeurs calculées
   --------------------------------------------------------- */

function setOut(key, texte, classe) {
  $$(`[data-out="${key}"]`).forEach((node) => {
    node.textContent = texte === "" || texte === null || texte === undefined ? "—" : texte;
    if (classe !== undefined) node.dataset.etat = classe;
  });
}

function etatChip(id, classe) {
  const node = $(id);
  if (!node) return;
  node.classList.remove("ok", "warn", "danger");
  if (classe) node.classList.add(classe);
}

function etatMini(id, classe) {
  const node = $(id);
  if (!node) return;
  node.classList.remove("ok", "warn", "danger");
  if (classe) node.classList.add(classe);
}

function refresh() {
  syncTerminus(true);
  derived = computeAll(state);
  const d = derived;

  /* Branches */
  d.legs.forEach((l, i) => {
    setOut(`leg.${i}.rm`, l.rm === null ? "" : `${capRound(l.rm)}°`);
    setOut(`leg.${i}.cm`, l.cm === null ? "" : `${capRound(l.cm)}°`);
    setOut(`leg.${i}.vs`, l.vs === null ? "" : `${Math.round(l.vs)} kt`);
    setOut(`leg.${i}.tsv`, l.tsv === null ? "" : `${Math.round(l.tsv)} mn`);
    setOut(`leg.${i}.cum`, l.cumTime === null ? "" : fmtHM(l.cumTime));
  });

  /* Points */
  d.points.forEach((p, i) => {
    setOut(`point.${i}.eto`, p.eto === null ? "" : fmtClock(p.eto));
    setOut(`point.${i}.cum`, p.cumTime === null ? "" : fmtHM(p.cumTime));
  });

  /* Totaux navigation */
  setOut("nav.dist", d.totalDist > 0 ? `${fmtNum(d.totalDist, 1)} NM` : "");
  setOut("nav.tsv", d.totalTsv > 0 ? fmtHM(d.totalTsv) : "");
  setOut("nav.tav", d.temps.trajet > 0 ? fmtHM(d.temps.trajet) : "");
  const ecart = d.totalTsv > 0 ? d.temps.trajet - d.totalTsv : null;
  setOut("nav.effetVent", ecart === null || Math.abs(ecart) < 0.5 ? "—" : `${ecart > 0 ? "+" : "−"}${Math.abs(Math.round(ecart))} mn`);
  setOut("nav.nbLegs", String(state.legs.length));
  const vDir = num(state.nav.ventDir), vVit = num(state.nav.ventVit);
  setOut("nav.ventInfo", vDir !== null && vVit !== null ? `${String(Math.round(vDir)).padStart(3, "0")}° / ${Math.round(vVit)} kt` : "Aucun vent saisi");

  /* Phases */
  let cum = 0;
  PHASES.forEach((p) => {
    cum += d.temps[p.key] || 0;
    setOut(`phase.${p.key}.cum`, d.temps[p.key] ? fmtHM(cum) : "—");
    const f = d.fuel.perPhase[p.key];
    setOut(`phase.${p.key}.fuel`, f === null || !d.temps[p.key] ? "—" : `${fmtNum(f, 1)} L`);
    const input = $(`#phase-body input[data-phase="${p.key}"]`);
    if (input && input.disabled) input.value = d.temps[p.key] || "";
  });
  setOut("phase.total.temps", fmtHM(d.temps.total));
  setOut("phase.total.fuel", d.fuel.total === null ? "—" : `${fmtNum(d.fuel.total, 1)} L`);
  setOut("temps.total", fmtHM(d.temps.total));
  setOut("temps.vol", fmtHM(d.temps.vol));
  setOut("temps.fuelTotal", d.fuel.total === null ? "" : `${fmtNum(d.fuel.total, 1)} L`);

  /* Carburant */
  setOut("fuel.aBordL", d.fuel.aBord === null ? "" : `${fmtNum(d.fuel.aBord, 1)} L`);
  setOut("fuel.masseCarb", d.fuel.masseCarb === null ? "" : `${fmtNum(d.fuel.masseCarb, 1)} kg`);
  setOut("fuel.densiteInfo", d.fuel.densite ? `${fuelLabel(state)} · ${d.fuel.densite.toFixed(3)} kg/L` : "densité inconnue");
  setOut("fuel.necessaire", d.fuel.total === null ? "" : `${fmtNum(d.fuel.total, 1)} L`);
  setOut("fuel.restant", d.fuel.restantApresVol === null ? "" : `${fmtNum(d.fuel.restantApresVol, 1)} L`);
  setOut("fuel.autonomie", d.fuel.autonomie === null ? "" : fmtHM(d.fuel.autonomie));
  const remplissage = d.fuel.capacite && d.fuel.aBord !== null ? (d.fuel.aBord / d.fuel.capacite) * 100 : null;
  setOut("fuel.remplissage", remplissage === null ? "" : `${Math.round(remplissage)} %`);
  etatMini("#ms-restant", d.fuel.restantL === null ? null : d.fuel.restantL < 0 ? "danger" : d.fuel.restantL < d.fuel.aBord * 0.05 ? "warn" : "ok");

  /* Masse */
  setOut("masse.total", d.masse.total === null ? "" : `${fmtNum(d.masse.total, 1)} kg`);
  setOut("masse.marge", d.masse.marge === null ? "" : `${d.masse.marge >= 0 ? "" : "−"}${fmtNum(Math.abs(d.masse.marge), 1)} kg`);
  etatMini("#ms-marge", d.masse.marge === null ? null : d.masse.marge < 0 ? "danger" : d.masse.marge < 30 ? "warn" : "ok");
  const detail = [
    d.masse.vide !== null ? `vide ${fmtNum(d.masse.vide, 0)}` : null,
    d.masse.equipage !== null ? `équip. ${fmtNum(d.masse.equipage, 0)}` : null,
    d.masse.pax !== null ? `pax ${fmtNum(d.masse.pax, 0)}` : null,
    d.masse.bagages !== null ? `bag. ${fmtNum(d.masse.bagages, 0)}` : null,
    d.masse.carburant !== null ? `carb. ${fmtNum(d.masse.carburant, 0)}` : null,
  ].filter(Boolean).join(" + ");
  setOut("masse.detail", detail || "vide + équipage + pax + bagages + carburant");

  /* Vol */
  setOut("vol.bloc", d.blocEstime === null ? "" : fmtClock(d.blocEstime));
  setOut("vol.arrivee", d.arriveeEstimee === null ? "" : fmtClock(d.arriveeEstimee));
  setOut("vol.vsMoy", d.vsMoyenne === null ? "" : `${Math.round(d.vsMoyenne)} kt`);

  /* Bandeau de synthèse */
  const route = [state.dep.icao, state.arr.icao].filter(Boolean).join(" ▸ ");
  setOut("chip.route", route || "—");
  setOut("chip.dist", d.totalDist > 0 ? `${fmtNum(d.totalDist, 0)} NM` : "—");
  setOut("chip.tempsVol", d.temps.vol ? fmtHM(d.temps.vol) : "—");
  setOut("chip.tempsTotal", d.temps.total ? fmtHM(d.temps.total) : "—");
  setOut("chip.carb", d.fuel.total === null ? "—" : `${fmtNum(d.fuel.total, 0)} L`);
  setOut("chip.carbSub", d.fuel.aBord === null ? "nécessaire" : `sur ${fmtNum(d.fuel.aBord, 0)} L à bord`);
  setOut("chip.autonomie", d.fuel.autonomie === null ? "—" : fmtHM(d.fuel.autonomie));
  setOut("chip.masse", d.masse.total === null ? "—" : `${fmtNum(d.masse.total, 0)} kg`);
  setOut("chip.masseSub", d.masse.mtow ? `MTOW ${fmtNum(d.masse.mtow, 0)} kg` : "MTOW non saisi");

  etatChip("#chip-carb", d.fuel.restantL === null ? null : d.fuel.restantL < 0 ? "danger" : "ok");
  etatChip("#chip-auto", d.fuel.autonomie === null || d.temps.total === 0 ? null
    : d.fuel.autonomie < d.temps.total ? "danger" : "ok");
  etatChip("#chip-masse", d.masse.marge === null ? null : d.masse.marge < 0 ? "danger" : d.masse.marge < 30 ? "warn" : "ok");

  /* Alertes */
  afficherAlertes();

  scheduleSave();
}

function afficherAlertes() {
  const carb = $("#alertes-carburant");
  const nav = $("#alertes-nav");
  const parCat = { carb: [], nav: [] };
  derived.alerts.forEach((a) => {
    const cible = /branche|dérive|vent|altitude|VCR/i.test(a.texte) ? "nav" : "carb";
    parCat[cible].push(a);
  });

  const remplir = (node, liste, classeDefaut) => {
    if (!node) return;
    node.innerHTML = "";
    node.className = "alert";
    if (!liste.length) return;
    const pire = liste.some((a) => a.niveau === "danger") ? "danger" : "warn";
    node.classList.add(pire || classeDefaut);
    node.appendChild(iconeSvg("#i-alert"));
    node.appendChild(el("div", {}, liste.map((a) => el("div", { text: a.texte }))));
  };

  remplir(carb, parCat.carb, "warn");
  remplir(nav, parCat.nav, "warn");
}

/* ---------------------------------------------------------
   Actions globales
   --------------------------------------------------------- */

function copierDepartVersArrivee() {
  ["icao", "qfu1", "qfu2", "alti", "app", "twr", "sol", "atis", "obs"].forEach((k) => {
    state.arr[k] = state.dep[k];
  });
  // Aller-retour : la piste d'arrivée est en général la réciproque
  fillStaticInputs();
  refresh();
  toast("Terrain de départ recopié en arrivée");
}

function reinitialiser() {
  if (!confirm("Effacer toutes les données saisies et repartir d'un log vierge ?")) return;
  Store.effacer();
  state = defaultState();
  fillStaticInputs();
  remplirListeCarburants();
  renderTimeline();
  renderPhases();
  refresh();
  window.scrollTo({ top: 0, behavior: "smooth" });
  toast("Nouveau log vierge");
}

const CANEVAS_BRIEFING = `MÉTÉO : TAF/METAR consultés, plafond ___ / visi ___
NOTAM : consultés le ___
ESPACES TRAVERSÉS :
ALTITUDE DE SÉCURITÉ :
MENACES : relief / ULM / zones P-D-R / activité parachutage
SÉCURITÉ : terrain de dégagement, panne au décollage, transpondeur 7000
EMPORT : documents avion, licences, cartes à jour, gilets`;

function insererCanevas() {
  const zone = $('textarea[data-path="notes"]');
  if (!zone) return;
  state.notes = state.notes ? state.notes + "\n" + CANEVAS_BRIEFING : CANEVAS_BRIEFING;
  zone.value = state.notes;
  refresh();
}

function activerNavSection() {
  const liens = $$("#section-nav a");
  const sections = liens.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  if (!("IntersectionObserver" in window) || !sections.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      liens.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${entry.target.id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => obs.observe(s));
}

/* ---------------------------------------------------------
   PDF
   --------------------------------------------------------- */

async function telechargerPdf(btn) {
  const libelle = btn ? btn.innerHTML : "";
  try {
    if (btn) { btn.disabled = true; btn.textContent = "Génération…"; }
    const pret = await ensurePdfLib();
    if (!pret) {
      toast("Bibliothèque PDF indisponible — vérifiez votre connexion", "err");
      return;
    }
    derived = computeAll(state);
    buildPdf(state, derived);
    toast("PDF généré");
  } catch (e) {
    console.error(e);
    toast("Erreur PDF : " + e.message, "err");
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = libelle; }
  }
}

/* ---------------------------------------------------------
   Démarrage
   --------------------------------------------------------- */

function initApp() {
  detecterFlexGap();

  const sauvegarde = Store.load();
  if (sauvegarde) state = sauvegarde;

  remplirListeCarburants();
  remplirPresetsAvion();
  remplirProfilsAvion();
  bindStaticInputs();
  fillStaticInputs();
  normaliserQfuOnBlur();
  renderTimeline();
  renderPhases();
  refresh();
  activerNavSection();

  if (sauvegarde) {
    const d = Store.dateMaj();
    toast(d ? `Log restauré (${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})` : "Log restauré");
  }
  if (!Store.disponible()) {
    const txt = $("#save-text");
    if (txt) txt.textContent = "Sauvegarde indisponible";
  }

  /* Boutons */
  $("#add-point")?.addEventListener("click", ajouterPoint);
  $("#reverse-route")?.addEventListener("click", inverserTrajet);
  $("#copy-dep-to-arr")?.addEventListener("click", copierDepartVersArrivee);
  $("#btn-reset")?.addEventListener("click", reinitialiser);
  $("#btn-modele-notes")?.addEventListener("click", insererCanevas);
  $("#btn-export")?.addEventListener("click", () => { exportJSON(state); toast("Log exporté"); });
  $("#btn-import")?.addEventListener("click", () => $("#file-import")?.click());
  $("#file-import")?.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      state = await importJSON(file);
      fillStaticInputs();
      remplirListeCarburants();
      renderTimeline();
      renderPhases();
      refresh();
      toast("Log importé");
    } catch (err) {
      toast("Fichier illisible", "err");
    }
    e.target.value = "";
  });

  $("#filtre-xp12")?.addEventListener("click", () => {
    state.avion.filtreXp12 = !state.avion.filtreXp12;
    remplirPresetsAvion();
    scheduleSave();
  });

  $("#preset-avion")?.addEventListener("change", (e) => {
    const preset = AIRCRAFT_PRESETS.find((a) => a.id === e.target.value);
    state.avion.preset = e.target.value;
    if (preset) { appliquerAvion({ ...preset, type: preset.label }); toast(`${preset.label} appliqué`); }
  });

  $("#profil-avion")?.addEventListener("change", (e) => {
    const p = Store.profils().find((x) => x.id === e.target.value);
    if (p) { appliquerAvion(p); toast(`${p.label} chargé`); }
  });

  $("#btn-save-profil")?.addEventListener("click", () => {
    const label = (state.avion.immat || state.avion.type || "").toUpperCase();
    if (!label) { toast("Renseignez le type ou l'immatriculation", "err"); return; }
    Store.enregistrerProfil({
      id: label,
      label,
      type: state.avion.type,
      immat: state.avion.immat,
      vcr: state.avion.vcr,
      mtow: state.avion.mtow,
      masseVide: state.avion.masseVide,
      capacite: state.avion.capacite,
      altitudeMax: state.avion.altitudeMax,
      nbPax: state.avion.nbPax,
      conso: state.carburant.conso,
      carburant: state.carburant.type,
      densite: state.carburant.densite,
    });
    remplirProfilsAvion();
    const sel = $("#profil-avion");
    if (sel) sel.value = label;
    toast(`Profil ${label} enregistré`);
  });

  $("#btn-del-profil")?.addEventListener("click", () => {
    const sel = $("#profil-avion");
    if (!sel || !sel.value) return;
    Store.supprimerProfil(sel.value);
    remplirProfilsAvion();
    toast("Profil supprimé");
  });

  const boutonsPdf = [$("#generate-pdf"), $("#generate-pdf-mobile")].filter(Boolean);
  boutonsPdf.forEach((b) => b.addEventListener("click", () => telechargerPdf(b)));

  // Ctrl/Cmd + S = PDF
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      telechargerPdf(boutonsPdf[0]);
    }
  });

  // Sauvegarde immédiate avant fermeture
  window.addEventListener("beforeunload", () => { clearTimeout(saveTimer); Store.save(state); });

  // Précharge la bibliothèque PDF sans bloquer
  ensurePdfLib().catch(() => {});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
