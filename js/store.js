/* =========================================================
   store.js — persistance locale, import/export, accès par chemin
   ========================================================= */

const STORAGE_KEY = "lognav.vfr.v2";
const PROFILES_KEY = "lognav.vfr.avions";

/** Lit une valeur dans un objet via un chemin "a.b.c". */
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Écrit une valeur dans un objet via un chemin "a.b.c". */
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let cur = obj;
  for (const k of keys) {
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
}

/** Fusion récursive d'un état sauvegardé dans l'état par défaut. */
function mergeState(base, saved) {
  if (!saved || typeof saved !== "object") return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(saved)) {
    if (Array.isArray(v)) out[k] = v;
    else if (v && typeof v === "object" && !Array.isArray(out[k]) && typeof out[k] === "object" && out[k] !== null) {
      out[k] = mergeState(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

const Store = {
  disponible() {
    try {
      const k = "__lognav_test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  },

  /** Sauvegarde l'état courant. */
  save(state) {
    if (!Store.disponible()) return false;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, _majAt: new Date().toISOString() })
      );
      return true;
    } catch (e) {
      console.warn("Sauvegarde impossible :", e);
      return false;
    }
  },

  /** Recharge l'état sauvegardé, fusionné avec les valeurs par défaut. */
  load() {
    if (!Store.disponible()) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const merged = mergeState(defaultState(), parsed);
      // Garantit la cohérence points/branches (n points -> n-1 branches)
      if (!Array.isArray(merged.points) || merged.points.length < 2) merged.points = defaultState().points;
      if (!Array.isArray(merged.legs)) merged.legs = [];
      while (merged.legs.length < merged.points.length - 1) merged.legs.push(newLeg());
      merged.legs.length = merged.points.length - 1;
      return merged;
    } catch (e) {
      console.warn("Restauration impossible :", e);
      return null;
    }
  },

  /** Date de dernière sauvegarde (Date ou null). */
  dateMaj() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw)._majAt;
      return d ? new Date(d) : null;
    } catch (e) {
      return null;
    }
  },

  effacer() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignoré */ }
  },

  /* --- Profils avion personnels --- */

  profils() {
    try {
      const raw = localStorage.getItem(PROFILES_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  },

  enregistrerProfil(profil) {
    const list = Store.profils().filter((p) => p.id !== profil.id);
    list.push(profil);
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      return false;
    }
  },

  supprimerProfil(id) {
    const list = Store.profils().filter((p) => p.id !== id);
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); } catch (e) { /* ignoré */ }
  },
};

/** Télécharge l'état sous forme de fichier JSON. */
function exportJSON(state) {
  const nom = [state.dep.icao, state.arr.icao].filter(Boolean).join("-") || "lognav";
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lognav-${nom}${state.meta.date ? "-" + state.meta.date : ""}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lit un fichier JSON de log et renvoie l'état fusionné. */
function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const merged = mergeState(defaultState(), parsed);
        if (!Array.isArray(merged.points) || merged.points.length < 2) throw new Error("Fichier incomplet");
        while (merged.legs.length < merged.points.length - 1) merged.legs.push(newLeg());
        merged.legs.length = merged.points.length - 1;
        resolve(merged);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
