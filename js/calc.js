/* =========================================================
   calc.js — toute la logique de calcul (fonctions pures)
   ========================================================= */

/** Convertit en nombre ; renvoie null si vide/invalide. */
function num(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    v = v.trim().replace(",", ".");
    if (v === "") return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Nombre ou 0. */
function num0(v) {
  const n = num(v);
  return n === null ? 0 : n;
}

/** Ramène un cap dans [0, 360[. */
function norm360(a) {
  if (!Number.isFinite(a)) return null;
  const r = a % 360;
  return r < 0 ? r + 360 : r;
}

/** Arrondit un cap à l'entier dans [1, 360] (0 affiché 360). */
function capRound(a) {
  const n = norm360(a);
  if (n === null) return null;
  const r = Math.round(n) % 360;
  return r === 0 ? 360 : r;
}

const DEG = Math.PI / 180;

/**
 * Triangle des vitesses.
 * @param {number} rv     route vraie (°)
 * @param {number} vp     vitesse propre (kt)
 * @param {number} vDir   direction d'où vient le vent (° vrai)
 * @param {number} vVit   vitesse du vent (kt)
 * @returns {{derive:number, capVrai:number, vs:number}|null}
 */
function windTriangle(rv, vp, vDir, vVit) {
  if (rv === null || vp === null || vp <= 0) return null;
  if (vVit === null || vDir === null) return { derive: 0, capVrai: norm360(rv), vs: vp };
  if (vVit === 0) return { derive: 0, capVrai: norm360(rv), vs: vp };

  const angle = (norm360(vDir) - norm360(rv)) * DEG;
  let sinX = (vVit * Math.sin(angle)) / vp;
  // Vent traversier plus fort que la Vp : route non tenable, on borne.
  sinX = Math.max(-1, Math.min(1, sinX));
  const derive = Math.asin(sinX);             // > 0 = correction à droite
  const vs = vp * Math.cos(derive) - vVit * Math.cos(angle);
  return {
    derive: derive / DEG,
    capVrai: norm360(rv + derive / DEG),
    vs: vs,
  };
}

/** Minutes -> "1h05" / "45 mn". */
function fmtHM(minutes, opts = {}) {
  const m = num(minutes);
  if (m === null || m < 0) return opts.vide !== undefined ? opts.vide : "—";
  const total = Math.round(m);
  const h = Math.floor(total / 60);
  const mn = total % 60;
  if (h === 0) return `${mn} mn`;
  return `${h} h ${String(mn).padStart(2, "0")}`;
}

/** Minutes -> "1:05" compact (PDF). */
function fmtHMShort(minutes, vide = "") {
  const m = num(minutes);
  if (m === null || m < 0) return vide;
  const total = Math.round(m);
  const h = Math.floor(total / 60);
  const mn = total % 60;
  return h === 0 ? `${mn}` : `${h}:${String(mn).padStart(2, "0")}`;
}

/** "HH:MM" -> minutes depuis minuit. */
function parseClock(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const m = hhmm.match(/^(\d{1,2})[:hH.]?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  if (h > 23 || mn > 59) return null;
  return h * 60 + mn;
}

/** minutes depuis minuit -> "HH:MM" (modulo 24 h). */
function fmtClock(minutes, vide = "") {
  const m = num(minutes);
  if (m === null) return vide;
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** Formate un nombre avec n décimales, "" si vide. */
function fmtNum(v, dec = 1, vide = "") {
  const n = num(v);
  if (n === null) return vide;
  return n.toFixed(dec);
}

/** Normalise un numéro de piste (QFU) sur 2 chiffres. */
function normalizeQfu(val) {
  const n = num(val);
  if (n === null) return "";
  let rw = Math.round(n);
  if (rw > 360) return "";
  if (rw > 36) rw = Math.round(rw / 10); // saisie en degrés (ex : 270 -> 27)
  rw = ((rw % 36) + 36) % 36;
  if (rw === 0) rw = 36;
  return String(rw).padStart(2, "0");
}

/** QFU réciproque. */
function reciprocalQfu(val) {
  const norm = normalizeQfu(val);
  if (!norm) return "";
  let recip = ((Number(norm) + 17) % 36) + 1;
  return String(recip).padStart(2, "0");
}

/** Densité effective du carburant sélectionné. */
function fuelDensity(state) {
  const d = num(state.carburant.densite);
  if (d !== null && d > 0) return d;
  const f = FUELS.find((x) => x.id === state.carburant.type);
  return f && f.densite ? f.densite : null;
}

/** Libellé du carburant sélectionné. */
function fuelLabel(state) {
  const f = FUELS.find((x) => x.id === state.carburant.type);
  if (!f) return "";
  if (f.id === "custom") return "Carburant personnalisé";
  return f.label;
}

/* ---------------------------------------------------------
   Calcul global
   --------------------------------------------------------- */

/**
 * Calcule tout ce qui peut l'être à partir de l'état.
 * Ne modifie jamais `state`.
 */
function computeAll(state) {
  const vpGlobal = num(state.avion.vcr);
  const dm = num0(state.nav.dm);
  const ventDirG = num(state.nav.ventDir);
  const ventVitG = num(state.nav.ventVit);
  const modeRm = state.nav.modeRoute === "rm";

  /* --- Branches --- */
  let cumDist = 0;
  let cumTime = 0;
  let cumTimeConnu = true;
  let totalTsv = 0;

  const legs = state.legs.map((leg, i) => {
    const dist = num(leg.dist);
    const routeSaisie = num(leg.route);
    const vp = num(leg.vp) !== null ? num(leg.vp) : vpGlobal;
    const vDir = num(leg.ventDir) !== null ? num(leg.ventDir) : ventDirG;
    const vVit = num(leg.ventVit) !== null ? num(leg.ventVit) : ventVitG;

    // Route vraie / magnétique (Dm comptée positive vers l'Est)
    let rv = null, rm = null;
    if (routeSaisie !== null) {
      if (modeRm) { rm = norm360(routeSaisie); rv = norm360(routeSaisie + dm); }
      else        { rv = norm360(routeSaisie); rm = norm360(routeSaisie - dm); }
    }

    const wt = windTriangle(rv, vp, vDir, vVit);
    const derive = wt ? wt.derive : null;
    const cm = wt && rm !== null ? norm360(rm + wt.derive) : rm;
    const vs = wt ? wt.vs : null;

    const tsv = dist !== null && vp !== null && vp > 0 ? (dist / vp) * 60 : null;
    let tav = dist !== null && vs !== null && vs > 0 ? (dist / vs) * 60 : null;

    const tman = num(leg.tman);
    const temps = tman !== null ? tman : (tav !== null ? tav : tsv);

    if (dist !== null) cumDist += dist;
    if (tsv !== null) totalTsv += tsv;
    if (temps !== null && cumTimeConnu) cumTime += temps;
    else if (temps === null) cumTimeConnu = false;

    return {
      i,
      dist,
      rv, rm,
      cm: cm !== null ? cm : null,
      derive,
      vp,
      vs,
      ventDir: vDir, ventVit: vVit,
      tsv, tav, temps,
      manuel: tman !== null,
      cumDist: dist !== null ? cumDist : null,
      cumTime: cumTimeConnu ? cumTime : null,
      notes: leg.notes || "",
    };
  });

  const totalDist = cumDist;
  const totalTemps = legs.reduce((s, l) => s + (l.temps || 0), 0);
  const tousTempsConnus = legs.every((l) => l.temps !== null);

  /* --- Points de report : heures estimées --- */
  const t0 = parseClock(state.meta.decollage);
  let acc = 0;
  const points = state.points.map((p, i) => {
    if (i > 0) {
      const l = legs[i - 1];
      acc += l && l.temps !== null ? l.temps : 0;
    }
    const connu = i === 0 || legs.slice(0, i).every((l) => l.temps !== null);
    return {
      i,
      nom: p.nom || "",
      alti: p.alti || "",
      obs: p.obs || "",
      cumTime: connu ? acc : null,
      eto: t0 !== null && connu ? t0 + acc : null,
    };
  });

  /* --- Temps par phase --- */
  const t = state.temps;
  const trajet = t.trajetAuto
    ? (tousTempsConnus && legs.length ? Math.round(totalTemps) : (legs.length ? Math.round(totalTemps) : 0))
    : num0(t.trajet);
  const resVent = t.resVentAuto ? Math.round(trajet * 0.1) : num0(t.resVent);

  const temps = {
    roulage: num0(t.roulage),
    trajet,
    resVent,
    proc: num0(t.proc),
    resObl: num0(t.resObl),
    resCom: num0(t.resCom),
  };
  temps.total = PHASES.reduce((s, p) => s + (temps[p.key] || 0), 0);
  // Temps de vol effectif (hors réserves non consommées) : roulage + trajet + procédure
  temps.vol = temps.roulage + temps.trajet + temps.proc;

  /* --- Carburant --- */
  const conso = num(state.carburant.conso);
  const densite = fuelDensity(state);
  const perPhase = {};
  PHASES.forEach((p) => {
    perPhase[p.key] = conso !== null ? (temps[p.key] / 60) * conso : null;
  });
  const fuelTotal = conso !== null ? (temps.total / 60) * conso : null;
  const fuelVol = conso !== null ? (temps.vol / 60) * conso : null;

  const aBord =
    num0(state.carburant.tankG) + num0(state.carburant.tankC) + num0(state.carburant.tankP);
  const aBordSaisi =
    num(state.carburant.tankG) !== null ||
    num(state.carburant.tankC) !== null ||
    num(state.carburant.tankP) !== null;

  const autonomie = conso !== null && conso > 0 && aBordSaisi ? (aBord / conso) * 60 : null;
  const restantL = fuelTotal !== null && aBordSaisi ? aBord - fuelTotal : null;
  const restantApresVol = fuelVol !== null && aBordSaisi ? aBord - fuelVol : null;
  const masseCarb = densite !== null && aBordSaisi ? aBord * densite : null;

  const capacite = num(state.avion.capacite);

  const fuel = {
    conso, densite, perPhase,
    total: fuelTotal,
    vol: fuelVol,
    aBord: aBordSaisi ? aBord : null,
    capacite,
    autonomie,
    restantL,
    restantApresVol,
    masseCarb,
    suffisant: restantL === null ? null : restantL >= 0,
  };

  /* --- Masse --- */
  const mVide = num(state.avion.masseVide);
  const mEq = num(state.masse.equipage);
  const mPax = num(state.masse.pax);
  const mBag = num(state.masse.bagages);
  const mtow = num(state.avion.mtow);
  const masseParts = [mVide, mEq, mPax, mBag, masseCarb];
  const masseSaisie = masseParts.some((x) => x !== null);
  const masseTotale = masseSaisie ? masseParts.reduce((s, x) => s + (x || 0), 0) : null;
  const masse = {
    vide: mVide, equipage: mEq, pax: mPax, bagages: mBag,
    carburant: masseCarb,
    total: masseTotale,
    mtow,
    marge: masseTotale !== null && mtow !== null ? mtow - masseTotale : null,
    complet: mVide !== null && mtow !== null,
  };

  /* --- Alertes --- */
  const alerts = [];
  if (fuel.restantL !== null && fuel.restantL < 0) {
    alerts.push({
      niveau: "danger",
      texte: `Carburant insuffisant : ${fmtNum(fuel.total, 1)} L nécessaires pour ${fmtNum(fuel.aBord, 1)} L embarqués (manque ${fmtNum(-fuel.restantL, 1)} L).`,
    });
  } else if (fuel.restantL !== null && fuel.aBord > 0 && fuel.restantL < fuel.aBord * 0.05) {
    alerts.push({ niveau: "warn", texte: "Marge carburant très faible (< 5 % de l'emport)." });
  }
  if (capacite !== null && fuel.aBord !== null && fuel.aBord > capacite) {
    alerts.push({
      niveau: "danger",
      texte: `Emport (${fmtNum(fuel.aBord, 1)} L) supérieur à la capacité utilisable de l'avion (${fmtNum(capacite, 1)} L).`,
    });
  }
  if (masse.marge !== null && masse.marge < 0) {
    alerts.push({
      niveau: "danger",
      texte: `Masse au décollage dépassée de ${fmtNum(-masse.marge, 1)} kg (MTOW ${fmtNum(mtow, 0)} kg).`,
    });
  }
  legs.forEach((l, i) => {
    if (l.vs !== null && l.vs <= 0) {
      alerts.push({ niveau: "danger", texte: `Branche ${i + 1} : vitesse sol nulle ou négative, vérifiez le vent.` });
    } else if (l.derive !== null && Math.abs(l.derive) > 25) {
      alerts.push({ niveau: "warn", texte: `Branche ${i + 1} : dérive de ${Math.round(l.derive)}°, vent traversier important.` });
    }
  });
  const altMax = num(state.avion.altitudeMax);
  if (altMax !== null) {
    state.legs.forEach((leg, i) => {
      const a = num(leg.alt);
      if (a !== null && a > altMax) {
        alerts.push({ niveau: "warn", texte: `Branche ${i + 1} : altitude ${a} ft au-dessus du plafond annoncé (${altMax} ft).` });
      }
    });
  }
  if (conso === null) alerts.push({ niveau: "warn", texte: "Consommation horaire non renseignée : les calculs carburant sont indisponibles." });
  if (vpGlobal === null) alerts.push({ niveau: "warn", texte: "Vitesse propre (VCR) non renseignée : les temps de branche ne peuvent pas être calculés." });

  return {
    legs, points,
    totalDist,
    totalTemps: tousTempsConnus || legs.length === 0 ? totalTemps : null,
    totalTsv,
    vsMoyenne: totalTemps > 0 && totalDist > 0 ? (totalDist / totalTemps) * 60 : null,
    temps, fuel, masse, alerts,
    arriveeEstimee: t0 !== null ? t0 + temps.trajet + temps.proc : null,
    blocEstime: t0 !== null ? t0 - temps.roulage : null,
  };
}
