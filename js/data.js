/* =========================================================
   data.js — référentiels (carburants, avions) et état par défaut
   ========================================================= */

/**
 * Carburants les plus utilisés en aviation légère.
 * `densite` en kg/L à 15 °C — valeurs normalisées usuelles.
 */
const FUELS = [
  { id: "avgas100ll", label: "AVGAS 100LL", densite: 0.72, note: "Essence aviation la plus répandue" },
  { id: "avgas100",   label: "AVGAS 100",   densite: 0.72, note: "Essence aviation (plombée)" },
  { id: "ul91",       label: "UL 91",       densite: 0.715, note: "Essence aviation sans plomb" },
  { id: "ul94",       label: "UL 94",       densite: 0.715, note: "Essence aviation sans plomb" },
  { id: "mogas",      label: "MOGAS SP95 / SP98", densite: 0.75, note: "Essence auto (si STC / autorisé)" },
  { id: "jeta1",      label: "Jet A-1",     densite: 0.80, note: "Kérosène — moteurs diesel / turbines" },
  { id: "jeta",       label: "Jet A",       densite: 0.81, note: "Kérosène (Amérique du Nord)" },
  { id: "jetb",       label: "Jet B",       densite: 0.78, note: "Kérosène grand froid" },
  { id: "diesel",     label: "Gazole / GNR", densite: 0.84, note: "Moteurs diesel certifiés" },
  { id: "custom",     label: "Autre (densité personnalisée)", densite: null, note: "Saisir la masse volumique" },
];

/** Familles utilisées pour regrouper la liste déroulante. */
const GROUPES_AVION = [
  { id: "ulm",       label: "ULM & très légers" },
  { id: "ecole",     label: "Monomoteurs école & club" },
  { id: "voyage",    label: "Monomoteurs de voyage" },
  { id: "bi",        label: "Bimoteurs, turbines & jets légers" },
  { id: "classique", label: "Classiques & historiques" },
];

/**
 * Profils avion indicatifs — à vérifier impérativement dans le manuel de vol.
 * vcr = croisière (kt) · conso = L/h · capacite = carburant utilisable (L)
 * nbPax = places passagers hors pilote · xp12 = présent par défaut dans X-Plane 12
 */
const AIRCRAFT_PRESETS = [
  /* --- ULM & très légers --- */
  { id: "aerolite103", groupe: "ulm", xp12: true, label: "Aerolite 103",              vcr: 50,  conso: 8,  mtow: 250,  masseVide: 115, capacite: 19,  carburant: "mogas",      altitudeMax: 10000, nbPax: 0 },
  { id: "alphatrainer",groupe: "ulm", label: "Pipistrel Alpha Trainer",               vcr: 100, conso: 12, mtow: 550,  masseVide: 290, capacite: 60,  carburant: "mogas",      altitudeMax: 12000, nbPax: 1 },
  { id: "p2008",       groupe: "ulm", label: "Tecnam P2008",                          vcr: 110, conso: 15, mtow: 600,  masseVide: 375, capacite: 100, carburant: "mogas",      altitudeMax: 13000, nbPax: 1 },
  { id: "wt9",         groupe: "ulm", label: "Aerospool Dynamic WT9",                 vcr: 120, conso: 14, mtow: 600,  masseVide: 300, capacite: 100, carburant: "mogas",      altitudeMax: 13000, nbPax: 1 },
  { id: "ctls",        groupe: "ulm", label: "Flight Design CTLS",                    vcr: 105, conso: 15, mtow: 600,  masseVide: 315, capacite: 130, carburant: "mogas",      altitudeMax: 10000, nbPax: 1 },

  /* --- Monomoteurs école & club --- */
  { id: "c152",        groupe: "ecole", xp12: true, label: "Cessna 152",              vcr: 95,  conso: 22, mtow: 757,  masseVide: 512, capacite: 93,  carburant: "avgas100ll", altitudeMax: 14700, nbPax: 1 },
  { id: "c172n",       groupe: "ecole", label: "Cessna 172N Skyhawk",                 vcr: 105, conso: 30, mtow: 1043, masseVide: 654, capacite: 152, carburant: "avgas100ll", altitudeMax: 13500, nbPax: 3 },
  { id: "c172s",       groupe: "ecole", xp12: true, label: "Cessna 172 SP Skyhawk",   vcr: 110, conso: 34, mtow: 1157, masseVide: 767, capacite: 189, carburant: "avgas100ll", altitudeMax: 14000, nbPax: 3 },
  { id: "dr400120",    groupe: "ecole", label: "Robin DR400-120",                     vcr: 105, conso: 25, mtow: 900,  masseVide: 570, capacite: 110, carburant: "avgas100ll", altitudeMax: 12000, nbPax: 3 },
  { id: "dr400140",    groupe: "ecole", label: "Robin DR400-140B",                    vcr: 115, conso: 32, mtow: 1000, masseVide: 610, capacite: 110, carburant: "avgas100ll", altitudeMax: 12000, nbPax: 3 },
  { id: "dr400160",    groupe: "ecole", label: "Robin DR400-160",                     vcr: 120, conso: 34, mtow: 1050, masseVide: 630, capacite: 110, carburant: "avgas100ll", altitudeMax: 12000, nbPax: 3 },
  { id: "dr400180",    groupe: "ecole", label: "Robin DR400-180 Régent",              vcr: 130, conso: 38, mtow: 1100, masseVide: 650, capacite: 110, carburant: "avgas100ll", altitudeMax: 12000, nbPax: 3 },
  { id: "pa28161",     groupe: "ecole", label: "Piper PA-28-161 Warrior II",          vcr: 105, conso: 32, mtow: 1055, masseVide: 660, capacite: 182, carburant: "avgas100ll", altitudeMax: 11000, nbPax: 3 },
  { id: "pa28181",     groupe: "ecole", label: "Piper PA-28-181 Archer",              vcr: 110, conso: 35, mtow: 1157, masseVide: 760, capacite: 189, carburant: "avgas100ll", altitudeMax: 14100, nbPax: 3 },
  { id: "tb9",         groupe: "ecole", label: "Socata TB9 Tampico",                  vcr: 105, conso: 30, mtow: 1060, masseVide: 650, capacite: 175, carburant: "avgas100ll", altitudeMax: 13000, nbPax: 3 },
  { id: "tb10",        groupe: "ecole", label: "Socata TB10 Tobago",                  vcr: 125, conso: 38, mtow: 1150, masseVide: 700, capacite: 210, carburant: "avgas100ll", altitudeMax: 13000, nbPax: 3 },
  { id: "da20",        groupe: "ecole", label: "Diamond DA20 Katana",                 vcr: 115, conso: 20, mtow: 800,  masseVide: 529, capacite: 91,  carburant: "avgas100ll", altitudeMax: 13000, nbPax: 1 },
  { id: "da40180",     groupe: "ecole", label: "Diamond DA40 (180 ch)",               vcr: 135, conso: 32, mtow: 1150, masseVide: 780, capacite: 106, carburant: "avgas100ll", altitudeMax: 16400, nbPax: 3 },
  { id: "da40ng",      groupe: "ecole", label: "Diamond DA40 NG",                     vcr: 128, conso: 22, mtow: 1280, masseVide: 890, capacite: 148, carburant: "jeta1",      altitudeMax: 16400, nbPax: 3 },
  { id: "aquila210",   groupe: "ecole", label: "Aquila A210",                         vcr: 115, conso: 17, mtow: 750,  masseVide: 480, capacite: 120, carburant: "avgas100ll", altitudeMax: 13000, nbPax: 1 },
  { id: "cap10",       groupe: "ecole", label: "Mudry CAP 10 B",                      vcr: 130, conso: 40, mtow: 830,  masseVide: 560, capacite: 72,  carburant: "avgas100ll", altitudeMax: 16000, nbPax: 1 },
  { id: "aa5b",        groupe: "ecole", label: "Grumman AA-5B Tiger",                 vcr: 130, conso: 38, mtow: 1088, masseVide: 635, capacite: 193, carburant: "avgas100ll", altitudeMax: 13800, nbPax: 3 },
  { id: "pa18",        groupe: "ecole", label: "Piper PA-18 Super Cub",               vcr: 85,  conso: 25, mtow: 794,  masseVide: 460, capacite: 136, carburant: "avgas100ll", altitudeMax: 16000, nbPax: 1 },
  { id: "l5",          groupe: "ecole", xp12: true, label: "Stinson L-5 Sentinel",    vcr: 80,  conso: 30, mtow: 953,  masseVide: 703, capacite: 132, carburant: "avgas100ll", altitudeMax: 15800, nbPax: 1 },

  /* --- Monomoteurs de voyage --- */
  { id: "c182t",       groupe: "voyage", label: "Cessna 182T Skylane",                vcr: 140, conso: 50, mtow: 1406, masseVide: 870,  capacite: 329, carburant: "avgas100ll", altitudeMax: 18100, nbPax: 3 },
  { id: "pa28r201",    groupe: "voyage", label: "Piper PA-28R-201 Arrow III",         vcr: 130, conso: 40, mtow: 1247, masseVide: 785,  capacite: 272, carburant: "avgas100ll", altitudeMax: 16200, nbPax: 3 },
  { id: "m20j",        groupe: "voyage", label: "Mooney M20J",                        vcr: 160, conso: 40, mtow: 1247, masseVide: 771,  capacite: 242, carburant: "avgas100ll", altitudeMax: 18800, nbPax: 3 },
  { id: "a36",         groupe: "voyage", label: "Beechcraft A36 Bonanza",             vcr: 165, conso: 60, mtow: 1656, masseVide: 1043, capacite: 280, carburant: "avgas100ll", altitudeMax: 18500, nbPax: 5 },
  { id: "sr20",        groupe: "voyage", label: "Cirrus SR20",                        vcr: 155, conso: 40, mtow: 1417, masseVide: 1010, capacite: 212, carburant: "avgas100ll", altitudeMax: 17500, nbPax: 3 },
  { id: "sr22",        groupe: "voyage", label: "Cirrus SR22",                        vcr: 180, conso: 60, mtow: 1633, masseVide: 1030, capacite: 348, carburant: "avgas100ll", altitudeMax: 17500, nbPax: 3 },
  { id: "rv10",        groupe: "voyage", xp12: true, label: "Van's RV-10",            vcr: 165, conso: 42, mtow: 1270, masseVide: 725,  capacite: 227, carburant: "avgas100ll", altitudeMax: 20000, nbPax: 3 },
  { id: "columbia400", groupe: "voyage", xp12: true, label: "Columbia 400 / Cessna 400", vcr: 200, conso: 65, mtow: 1633, masseVide: 1088, capacite: 386, carburant: "avgas100ll", altitudeMax: 25000, nbPax: 3 },

  /* --- Bimoteurs, turbines & jets légers --- */
  { id: "da42",        groupe: "bi", label: "Diamond DA42 Twin Star",                 vcr: 160, conso: 40,  mtow: 1900, masseVide: 1370, capacite: 189,  carburant: "jeta1",      altitudeMax: 18000, nbPax: 3 },
  { id: "da62",        groupe: "bi", label: "Diamond DA62",                           vcr: 180, conso: 60,  mtow: 2300, masseVide: 1450, capacite: 292,  carburant: "jeta1",      altitudeMax: 20000, nbPax: 6 },
  { id: "baron58",     groupe: "bi", xp12: true, label: "Beechcraft Baron 58",        vcr: 200, conso: 110, mtow: 2495, masseVide: 1660, capacite: 636,  carburant: "avgas100ll", altitudeMax: 20600, nbPax: 5 },
  { id: "evolution",   groupe: "bi", xp12: true, label: "Lancair Evolution",          vcr: 220, conso: 150, mtow: 1996, masseVide: 1180, capacite: 719,  carburant: "jeta1",      altitudeMax: 28000, nbPax: 3 },
  { id: "sf50",        groupe: "bi", xp12: true, label: "Cirrus Vision SF50",         vcr: 240, conso: 250, mtow: 2722, masseVide: 1655, capacite: 1170, carburant: "jeta1",      altitudeMax: 31000, nbPax: 4 },
  { id: "c90b",        groupe: "bi", xp12: true, label: "Beechcraft King Air C90B",   vcr: 226, conso: 290, mtow: 4581, masseVide: 3050, capacite: 1453, carburant: "jeta1",      altitudeMax: 30000, nbPax: 6 },
  { id: "p180",        groupe: "bi", xp12: true, label: "Piaggio P180 Avanti II",     vcr: 320, conso: 470, mtow: 5488, masseVide: 3400, capacite: 1450, carburant: "jeta1",      altitudeMax: 41000, nbPax: 7 },

  /* --- Classiques & historiques --- */
  { id: "j3cub",       groupe: "classique", label: "Piper J-3 Cub",                   vcr: 65,  conso: 18,  mtow: 550,   masseVide: 345,  capacite: 45,   carburant: "avgas100ll", altitudeMax: 11500, nbPax: 1 },
  { id: "rallye",      groupe: "classique", label: "Morane-Saulnier MS893 Rallye",    vcr: 105, conso: 32,  mtow: 1050,  masseVide: 620,  capacite: 110,  carburant: "avgas100ll", altitudeMax: 13000, nbPax: 3 },
  { id: "dc3",         groupe: "classique", label: "Douglas DC-3",                    vcr: 150, conso: 380, mtow: 11431, masseVide: 8030, capacite: 3160, carburant: "avgas100ll", altitudeMax: 23200, nbPax: 28 },
];

/** Phases de vol du bloc carburant / temps. */
const PHASES = [
  { key: "roulage",  label: "Roulage / départ",     sub: "mise en route, roulage, essais",  defaut: 10 },
  { key: "trajet",   label: "Trajet",               sub: "somme des branches de navigation", defaut: 0, auto: true },
  { key: "resVent",  label: "Réserve vent",         sub: "marge météo / déroutement local",  defaut: 0, autoPct: true },
  { key: "proc",     label: "Procédure d'arrivée",  sub: "intégration, circuit, atterrissage", defaut: 10 },
  { key: "resObl",   label: "Réserve réglementaire", sub: "30 mn VFR jour / 45 mn VFR nuit", defaut: 30 },
  { key: "resCom",   label: "Réserve commandant de bord", sub: "marge personnelle",          defaut: 15 },
];

/** État vierge de l'application. */
function defaultState() {
  return {
    version: 2,
    meta: { date: "", pilote: "", decollage: "", indicatif: "" },
    avion: {
      type: "", immat: "", vcr: "", masseVide: "", mtow: "",
      altitudeMax: "", nbPax: "", capacite: "", preset: "", filtreXp12: false,
    },
    carburant: {
      type: "avgas100ll",
      densite: 0.72,
      conso: "",
      tankG: "", tankC: "", tankP: "",
      obs: "",
    },
    masse: { equipage: "", pax: "", bagages: "" },
    nav: { ventDir: "", ventVit: "", dm: "", modeRoute: "rv" },
    dep: { icao: "", qfu1: "", qfu2: "", alti: "", app: "", twr: "", sol: "", atis: "", obs: "" },
    arr: { icao: "", qfu1: "", qfu2: "", alti: "", app: "", twr: "", sol: "", atis: "", obs: "", notes: "" },
    deg: { icao: "", dist: "", freq: "", alti: "", obs: "" },
    points: [
      { nom: "", alti: "", obs: "", auto: true },
      { nom: "", alti: "", obs: "", auto: true },
    ],
    legs: [
      { alt: "", route: "", dist: "", vp: "", ventDir: "", ventVit: "", notes: "" },
    ],
    temps: {
      roulage: 10, trajet: "", trajetAuto: true, resVent: "", resVentAuto: true,
      proc: 10, resObl: 30, resCom: 15,
    },
    notes: "",
  };
}

/** Fabrique un point de report vierge. */
function newPoint() {
  return { nom: "", alti: "", obs: "", auto: false };
}

/** Fabrique une branche vierge. */
function newLeg() {
  return { alt: "", route: "", dist: "", vp: "", ventDir: "", ventVit: "", tman: "", notes: "" };
}
