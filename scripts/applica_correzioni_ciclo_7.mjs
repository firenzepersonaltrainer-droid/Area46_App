import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const VAULT_4_FILE = path.join(ROOT_DIR, "data", "vault", "4_metodologia_esercizi.json");
const VAULT_5_FILE = path.join(ROOT_DIR, "data", "vault", "5_metodologia_allenamenti_cicli.json");
const VAULT_RULES_FILE = path.join(ROOT_DIR, "data", "vault", "regole_esercizi_metodologia.json");
const REGISTRO_PRO_FILE = path.join(ROOT_DIR, "registro_periodizzazione_pro.json");
const DEMO_DATA_FILE = path.join(ROOT_DIR, "demo-data.json");
const API_INDEX_FILE = path.join(ROOT_DIR, "api", "index.js");

console.log("=== APPLICAZIONE CORREZIONI METODOLOGICHE COACH (CICLO 3 E CICLO 7) ===");

// 1. CORREZIONE CATALOGO VAULT 4
const vault4 = JSON.parse(fs.readFileSync(VAULT_4_FILE, "utf-8"));
for (const ex of vault4.database_esercizi || []) {
  const eid = String(ex.id_esercizio).padStart(3, "0");
  if (eid === "065") {
    // Dynamic High Pull (non High Pull ISO)
    ex.link_video = "https://youtu.be/Fsi34_9SXTU";
    console.log("✅ Vault 4: Corretto link video per ID 065 (High Pull dinamico -> https://youtu.be/Fsi34_9SXTU).");
  }
  if (eid === "239") {
    // Gymnasty ABS non deve avere il link di Knee drives
    ex.link_video = "";
    console.log("✅ Vault 4: Rimosso link video errato di Knee drives da ID 239 (Gymnasty ABS).");
  }
  if (eid === "240") {
    ex.link_video = "https://www.youtube.com/shorts/2LBsvhVglwA";
  }
}
fs.writeFileSync(VAULT_4_FILE, JSON.stringify(vault4, null, 2), "utf-8");

// 2. CORREZIONE REGOLE ESECUTIVE VAULT RULES
const rules = JSON.parse(fs.readFileSync(VAULT_RULES_FILE, "utf-8"));
if (!rules.regole_specifiche_esercizi) rules.regole_specifiche_esercizi = {};

// Regola Wall Driver
rules.regole_specifiche_esercizi["047"] = {
  id: "047",
  nome: "wall driver",
  attrezzo: "corpo libero",
  categoria: "warm up e mobilità",
  pattern: "cerniera d'anca, spinta controlaterale da terra sul muro",
  ruolo: "",
  modalita_prescrizione_predefinita: "TEMPO_ALTERNATO_CONTINUO",
  vincolo_notazione: "VIETATO_PIU",
  note_obbligatorie: [],
  divieti_tassativi: [
    "VIETATO_NOTAZIONE_PIU: esercizio alternato continuo, prescrivere a tempo complessivo continuo (es. 3 X 45\")."
  ],
  didattica_primo_utilizzo: null
};

// Regola Landmine Quick Hops: mai a freddo
if (rules.regole_specifiche_esercizi["099"]) {
  rules.regole_specifiche_esercizi["099"].divieti_tassativi = [
    "VIETATO_A_FREDDO: esercizio di pliometria e potenza elastica, mai inserire nel primo blocco di warm-up iniziale."
  ];
}

// Regola Push the Wall Squat: vietato in PRO
if (rules.regole_specifiche_esercizi["042"]) {
  rules.regole_specifiche_esercizi["042"].divieti_tassativi = [
    "VIETATO_LIVELLO_PRO: esercizio propedeutico per home training, non idoneo al condizionamento del livello PRO."
  ];
}

// Regola Matador Transitions
if (rules.regole_specifiche_esercizi["242"]) {
  rules.regole_specifiche_esercizi["242"].note_obbligatorie = [
    "Heavy Rope flow, coordinazione scapolo-omerale, destrezza e rotazione su piano traverso"
  ];
}

// Regola High Pull: niente progressione a 3 fasi
if (rules.regole_specifiche_esercizi["065"]) {
  rules.regole_specifiche_esercizi["065"].divieti_tassativi = [
    "NON_RICHIEDE_PROGRESSIONE: esercizio consolidato nei livelli precedenti, prescrivere direttamente carichi allenanti."
  ];
}

fs.writeFileSync(VAULT_RULES_FILE, JSON.stringify(rules, null, 2), "utf-8");
console.log("✅ Regole Esecutive aggiornate e blindate in data/vault/regole_esercizi_metodologia.json.");

// 3. AGGIORNAMENTO CICLO 3 IN VAULT 5 (INVERSIONE AERIAL JERK -> SPLIT JUMPS)
const vault5 = JSON.parse(fs.readFileSync(VAULT_5_FILE, "utf-8"));
let c3Modifiche = 0;
for (const a of vault5.allenamenti || []) {
  if (a.settimana === "Ciclo 3" && ["14 allenamento B", "16 allenamento B", "18 allenamento B"].includes(a.giorno)) {
    if (String(a.id_esercizio).padStart(3, "0") === "120" || (a.nome_esercizio || "").toLowerCase().includes("aerial jerk")) {
      a.id_esercizio = "134";
      a.nome_esercizio = "Split Jumps (sagittale)";
      a.link_video = "https://youtube.com/shorts/YoTx91IUJtk";
      if (a.giorno === "14 allenamento B") a.parametri = "x 6+6";
      if (a.giorno === "16 allenamento B") a.parametri = "x 8+8";
      if (a.giorno === "18 allenamento B") a.parametri = "x 10+10";
      a.note_tecniche = "AMRAP 12' | propedeutica saltata e stabilità split";
      c3Modifiche++;
    }
  }
}
console.log(`✅ Ciclo 3 aggiornato: sostituito Aerial Jerk con Split Jumps (sagittale) in ${c3Modifiche} sedute.`);

// 4. AGGIORNAMENTO CICLO 7 IN VAULT 5
function getEserciziA() {
  return [
    {
      seq: "1a",
      id: "029",
      nome: "Ground Stretch",
      param: "3x10+10",
      rec: "",
      note: "jump set | mobilità catene crociate e allungamento flessori anca",
      video: "https://youtube.com/shorts/4defoi83APo",
    },
    {
      seq: "1b",
      id: "074",
      nome: "Side move",
      param: "3x10+10",
      rec: '45"',
      note: "jump set | traslazione laterale a basso impatto per attivazione a freddo",
      video: "https://youtube.com/shorts/wKGZkYkCzHc",
    },
    {
      seq: "2",
      id: "128",
      nome: "COMBO: Landmine Split snatch High hand switch T/GO",
      param: "4x6+6",
      rec: 'RBS 75"',
      note: "Fondamentale Potenza Mesociclo 3 | RPE 8 | mantieni la traiettoria del bilanciere fluida nello scambio aereo",
      video: "https://youtube.com/shorts/I9GYUvD_Ink",
    },
    {
      seq: "3a",
      id: "023",
      nome: "Coiled Cable ROW",
      param: "4x8+8",
      rec: "",
      note: "jump set | RPE 8 | trazione rotazionale con cavo/elastico",
      video: "https://youtu.be/OdhNUbqajmM",
    },
    {
      seq: "3b",
      id: "219",
      nome: "Punch isoinerziale",
      param: '4x40"+40"',
      rec: '60"',
      note: "jump set | RPE 8 | spinta rotazionale continua del tronco",
      video: "https://youtu.be/-j07Q_jaTOA",
    },
    {
      seq: "4",
      id: "242",
      nome: "Underhand/Overhand Matador Transitions",
      param: "1x5'",
      rec: '60"',
      note: "Heavy Rope flow, coordinazione scapolo-omerale, destrezza e rotazione su piano traverso",
      video: "https://www.youtube.com/watch?v=4k2O1hameP0",
    },
    {
      seq: "5",
      id: "065",
      nome: "High Pull",
      param: "4x6+6",
      rec: '60"',
      note: "RPE 8 | spinta esplosiva dall'anca e tirata alta dinamica con gomito esterno",
      video: "https://youtu.be/Fsi34_9SXTU",
    },
    {
      seq: "6a",
      id: "089",
      nome: "Deadbug",
      param: "3x10+10",
      rec: "",
      note: "circuito (3 round) | core stability, catene crociate con palla",
      video: "https://youtu.be/b4InDUstH8Y?si=NP68qp2ACf_YIo2-",
    },
    {
      seq: "6b",
      id: "243",
      nome: "vogatore",
      param: '3x90"',
      rec: '60"',
      note: "circuito (3 round) | hip hinge, catena estensoria",
      video: "https://youtube.com/shorts/LJtEOWOPcs0?si=M8nmE_1THh0Gj20a",
    },
  ];
}

function getEserciziB(round) {
  const amrapTime = round === 1 ? "10'" : round === 2 ? "11'" : "13'";
  const skyergLungesParam = round === 1 ? "x 10+10" : round === 2 ? "x 12+12" : "x 15+15";

  let aerialJerkParam = '3x20"+20"';
  let aerialJerkRec = '45"';
  let aerialJerkNote = "cerca la massima esplosività adeguata al tuo livello";

  if (round === 1) {
    aerialJerkParam = "costruzione motoria";
    aerialJerkRec = '45"';
    aerialJerkNote = "costruzione dell’esercizio: dedica il tempo necessario all’apprendimento motorio. Chiedi al coach una progressione adeguata al tuo livello";
  } else if (round === 2) {
    aerialJerkParam = "4x6+6";
    aerialJerkRec = '60"';
    aerialJerkNote = "lavora con calma e lentezza, dai la precedenza alla tecnica anziché sull’intensità";
  } else {
    aerialJerkParam = '3x20"+20"';
    aerialJerkRec = '45"';
    aerialJerkNote = "cerca la massima esplosività adeguata al tuo livello";
  }

  return [
    {
      seq: "1a",
      id: "047",
      nome: "wall driver",
      param: '3 X 45"',
      rec: "",
      note: "jump set | spinta a parete diagonale alternata continua, spalla e core",
      video: "https://youtube.com/shorts/xK2pqjLUPl4",
    },
    {
      seq: "1b",
      id: "177",
      nome: "Clubbell Throw 180°",
      param: '3x60"+60"',
      rec: '45"',
      note: "jump set | senza pausa tra i lati | utilizzare una clava leggera per le prime volte, per abituare i polsi al movimento senza stressarli troppo",
      video: "https://youtu.be/gR25zBvBa48?si=kDHi-rlIwuOA4q6v",
    },
    {
      seq: "2",
      id: "056",
      nome: "Landmine coiled Deadlift",
      param: "4x6+6",
      rec: 'RBS 75"',
      note: "Fondamentale Cerniera d'Anca Mesociclo 3 | RPE 8 | caricamento della spirale fasciale dell'anca d'appoggio",
      video: "https://youtu.be/q8pfMEqSrm8",
    },
    {
      seq: "3a",
      id: "174",
      nome: "DB/Kett split snatch",
      param: "4x6+6",
      rec: "",
      note: "jump set | RPE 8 (se il movimento è incerto non tenere conto dell’RPE indicato, concentrati sugli aspetti tecnici)",
      video: "https://youtu.be/rE8lJ9TxbEQ",
    },
    {
      seq: "3b",
      id: "028",
      nome: "Transverse hold",
      param: '4x30"+30"',
      rec: 'RBS 45"',
      note: "jump set | creare contro-rotazione del bacino su torace (chiedi all’istruttore)",
      video: "https://youtu.be/aJ98KT13FtE?si=Li6fp-kbyh4wCnfT",
    },
    {
      seq: "4",
      id: "120",
      nome: "Aerial Jerk",
      param: aerialJerkParam,
      rec: aerialJerkRec,
      note: aerialJerkNote,
      video: "https://youtube.com/shorts/b1DU11BZKCk",
    },
    {
      seq: "5a",
      id: "229",
      nome: "Split Clean T&go",
      param: "x 6+6",
      rec: "",
      note: `AMRAP ${amrapTime} | cadenza continua e stabilità nello split`,
      video: "https://youtube.com/shorts/PQ-Ga27AgoM",
    },
    {
      seq: "5b",
      id: "106",
      nome: "Dragon Roll",
      param: "x 8+8",
      rec: "",
      note: `AMRAP ${amrapTime} | rotazione dinamica Heavy Rope`,
      video: "https://youtu.be/I3Jpk2S2bRE?si=IkQQs9ghbHbBufWV",
    },
    {
      seq: "5c",
      id: "227",
      nome: "Skyerg lunges",
      param: skyergLungesParam,
      rec: "",
      note: `AMRAP ${amrapTime} | combinazione tirata Skierg e stabilità split`,
      video: "https://youtube.com/shorts/kYfL3_rgym8",
    },
  ];
}

// Rigenera Ciclo 7 in Vault 5
let allenamenti = vault5.allenamenti.filter((r) => r.settimana !== "Ciclo 7");
let nextId = allenamenti.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;

const plan = [
  { num: 37, tipo: "A", round: 1 },
  { num: 38, tipo: "B", round: 1 },
  { num: 39, tipo: "A", round: 2 },
  { num: 40, tipo: "B", round: 2 },
  { num: 41, tipo: "A", round: 3 },
  { num: 42, tipo: "B", round: 3 },
];

const ciclo7Rows = [];
for (const s of plan) {
  const giornoStr = `${s.num} allenamento ${s.tipo}`;
  const list = s.tipo === "A" ? getEserciziA() : getEserciziB(s.round);

  for (const ex of list) {
    const row = {
      id: nextId++,
      livello: "PRO",
      settimana: "Ciclo 7",
      giorno: giornoStr,
      sequenza: ex.seq,
      id_esercizio: String(ex.id).padStart(3, "0"),
      nome_esercizio: ex.nome,
      parametri: ex.param,
      recupero: ex.rec,
      minutaggio_blocco: "",
      note_tecniche: ex.note,
      link_video: ex.video,
      data_pubblicazione: null,
    };
    allenamenti.push(row);
    ciclo7Rows.push(row);
  }
}

vault5.allenamenti = allenamenti;
fs.writeFileSync(VAULT_5_FILE, JSON.stringify(vault5, null, 2), "utf-8");
console.log(`✅ Vault 5: Rigenerate le 54 righe del Ciclo 7 con tutte le correzioni del coach.`);

// 5. SINCRONIZZA DEMO-DATA.JSON
if (fs.existsSync(DEMO_DATA_FILE)) {
  const demoData = JSON.parse(fs.readFileSync(DEMO_DATA_FILE, "utf-8"));
  
  // Aggiorna catalogo esercizi in demo-data
  for (const ex of demoData.esercizi || []) {
    const eid = String(ex.id_esercizio).padStart(3, "0");
    if (eid === "065") ex.link_video = "https://youtu.be/Fsi34_9SXTU";
    if (eid === "239") ex.link_video = "";
    if (eid === "240") ex.link_video = "https://www.youtube.com/shorts/2LBsvhVglwA";
  }

  // Sostituisci in Ciclo 3
  for (const a of demoData.allenamenti || []) {
    if (a.settimana === "Ciclo 3" && ["14 allenamento B", "16 allenamento B", "18 allenamento B"].includes(a.giorno)) {
      if (String(a.id_esercizio).padStart(3, "0") === "120" || (a.nome_esercizio || "").toLowerCase().includes("aerial jerk")) {
        a.id_esercizio = "134";
        a.nome_esercizio = "Split Jumps (sagittale)";
        a.link_video = "https://youtube.com/shorts/YoTx91IUJtk";
        if (a.giorno === "14 allenamento B") a.parametri = "x 6+6";
        if (a.giorno === "16 allenamento B") a.parametri = "x 8+8";
        if (a.giorno === "18 allenamento B") a.parametri = "x 10+10";
        a.note_tecniche = "AMRAP 12' | propedeutica saltata e stabilità split";
      }
    }
  }

  let demoAllenamenti = (demoData.allenamenti || []).filter((r) => r.settimana !== "Ciclo 7");
  demoAllenamenti.push(...ciclo7Rows);
  demoData.allenamenti = demoAllenamenti;
  fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(demoData, null, 2), "utf-8");
  console.log(`✅ demo-data.json aggiornato e sincronizzato.`);
}

// 6. AGGIORNA REGISTRO PERIODIZZAZIONE PRO
if (fs.existsSync(REGISTRO_PRO_FILE)) {
  const reg = JSON.parse(fs.readFileSync(REGISTRO_PRO_FILE, "utf-8"));
  reg.ciclo_attivo_da_pianificare = "Ciclo 8 (Mesociclo 3)";
  reg.mesociclo_attuale = "Mesociclo 3 (Cicli 7, 8, 9) - IN CORSO";
  if (!reg.storico_cicli) reg.storico_cicli = {};
  reg.storico_cicli["Ciclo 7"] = {
    status: "attivo / programmato",
    sessioni: 6,
    focus: "Avvio Mesociclo 3: Rientro Potenza & Hinge Fondamentale (COMBO Landmine Split Snatch H-H Switch, Landmine Coiled Deadlift), Matador Transitions 242, Coiled Cable Row, High Pull dinamico, Wall Driver continuo e Aerial Jerk in progressione",
  };

  const c7_used_ids = [
    "029", "074", "128", "023", "219", "242", "065", "089", "243",
    "047", "177", "056", "174", "028", "120", "229", "106", "227"
  ].map((id) => String(parseInt(id, 10)));

  for (const ex of reg.esercizi || []) {
    const eid = String(parseInt(ex.id, 10));
    if (c7_used_ids.includes(eid)) {
      ex.usage_count = (ex.usage_count || 0) + 1;
      ex.last_cycle_used = "Ciclo 7";
    }
    // Rimuovi conteggio se era stato erroneamente marcato in Ciclo 7 prima
    if (["42", "99", "239", "105"].includes(eid) && ex.last_cycle_used === "Ciclo 7") {
      ex.usage_count = Math.max(0, (ex.usage_count || 1) - 1);
      ex.last_cycle_used = null;
    }
    // Split Jumps usato in Ciclo 3
    if (eid === "134") {
      ex.usage_count = Math.max(1, ex.usage_count || 0);
      ex.last_cycle_used = "Ciclo 3";
    }
  }

  const usati = (reg.esercizi || []).filter((e) => (e.usage_count || 0) > 0).length;
  reg.esercizi_utilizzati = usati;
  fs.writeFileSync(REGISTRO_PRO_FILE, JSON.stringify(reg, null, 2), "utf-8");
  console.log(`✅ Registro Periodizzazione PRO aggiornato: ${usati}/163 esercizi PRO sperimentati.`);
}
