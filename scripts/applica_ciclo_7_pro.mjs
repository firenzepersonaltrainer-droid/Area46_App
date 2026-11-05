import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const VAULT_5_FILE = path.join(ROOT_DIR, "data", "vault", "5_metodologia_allenamenti_cicli.json");
const REGISTRO_PRO_FILE = path.join(ROOT_DIR, "registro_periodizzazione_pro.json");
const DEMO_DATA_FILE = path.join(ROOT_DIR, "demo-data.json");
const API_INDEX_FILE = path.join(ROOT_DIR, "api", "index.js");

// Esercizi Seduta A con progressione A1 (37), A2 (39), A3 (41)
function getEserciziA(round) {
  let highPullParam = '3x20"+20"';
  let highPullRec = '45"';
  let highPullNote = "cerca la massima esplosività adeguata al tuo livello";

  if (round === 1) {
    highPullParam = "costruzione motoria";
    highPullRec = '45"';
    highPullNote = "costruzione dell’esercizio: dedica il tempo necessario all’apprendimento motorio. Chiedi al coach una progressione adeguata al tuo livello";
  } else if (round === 2) {
    highPullParam = "4x8+8";
    highPullRec = '60"';
    highPullNote = "lavora con calma e lentezza, dai la precedenza alla tecnica anziché sull’intensità";
  } else {
    highPullParam = '3x20"+20"';
    highPullRec = '45"';
    highPullNote = "cerca la massima esplosività adeguata al tuo livello";
  }

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
      id: "099",
      nome: "Landmine quick Hops",
      param: '3x20"+20"',
      rec: '45"',
      note: "jump set | reattività elastica piede e caviglia, bilanciere come guida",
      video: "https://youtube.com/shorts/zNy3VT6hhfg",
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
      id: "042",
      nome: "Push the wall squat",
      param: "4x8+8",
      rec: "",
      note: "jump set | propedeutica squat asimmetrico e spinta laterale a parete",
      video: "https://youtube.com/shorts/3a_ww0jGYsM",
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
      id: "105",
      nome: "Underhand Matadors Wheel",
      param: "1x5'",
      rec: '60"',
      note: "Heavy Rope flow: traiettoria circolare continua sotto mano, rotazione scapolo-omerale e stabilità pelvica",
      video: "https://youtu.be/QDYnAATZuKc?si=BpQLXXXqB0_bA6Ng",
    },
    {
      seq: "5",
      id: "065",
      nome: "High Pull",
      param: highPullParam,
      rec: highPullRec,
      note: highPullNote,
      video: "https://youtube.com/shorts/A2eyrizhMVM",
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
      id: "239",
      nome: "Gymnasty ABS",
      param: "3x8-10",
      rec: '60"',
      note: "circuito (3 round) | anti-estensione e tenuta isometrica/dinamica",
      video: "https://youtube.com/shorts/2LBsvhVglwA",
    },
  ];
}

// Esercizi Seduta B con progressione B1 (38), B2 (40), B3 (42)
function getEserciziB(round) {
  const amrapTime = round === 1 ? "10'" : round === 2 ? "11'" : "13'";
  const skyergLungesParam = round === 1 ? "x 10+10" : round === 2 ? "x 12+12" : "x 15+15";

  let splitJumpsParam = '3x20"+20"';
  let splitJumpsRec = '45"';
  let splitJumpsNote = "cerca la massima esplosività adeguata al tuo livello";

  if (round === 1) {
    splitJumpsParam = "costruzione motoria";
    splitJumpsRec = '45"';
    splitJumpsNote = "costruzione dell’esercizio: dedica il tempo necessario all’apprendimento motorio. Chiedi al coach una progressione adeguata al tuo livello";
  } else if (round === 2) {
    splitJumpsParam = "4x8+8";
    splitJumpsRec = '60"';
    splitJumpsNote = "lavora con calma e lentezza, dai la precedenza alla tecnica anziché sull’intensità";
  } else {
    splitJumpsParam = '3x20"+20"';
    splitJumpsRec = '45"';
    splitJumpsNote = "cerca la massima esplosività adeguata al tuo livello";
  }

  return [
    {
      seq: "1a",
      id: "047",
      nome: "wall driver",
      param: '3x30"+30"',
      rec: "",
      note: "jump set | spinta a parete diagonale, spalla e core",
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
      id: "134",
      nome: "Split Jumps (sagittale)",
      param: splitJumpsParam,
      rec: splitJumpsRec,
      note: splitJumpsNote,
      video: "https://youtube.com/shorts/YoTx91IUJtk",
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

// 1. Carica Vault 5
const vault5 = JSON.parse(fs.readFileSync(VAULT_5_FILE, "utf-8"));
let allenamenti = vault5.allenamenti || [];

// Rimuovi eventuali righe già presenti di Ciclo 7 per idempotenza
allenamenti = allenamenti.filter((r) => r.settimana !== "Ciclo 7");

let nextId = allenamenti.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;

const plan = [
  { num: 37, tipo: "A", round: 1 },
  { num: 38, tipo: "B", round: 1 },
  { num: 39, tipo: "A", round: 2 },
  { num: 40, tipo: "B", round: 2 },
  { num: 41, tipo: "A", round: 3 },
  { num: 42, tipo: "B", round: 3 },
];

let nuoveRighe = 0;
const ciclo7Rows = [];

for (const s of plan) {
  const giornoStr = `${s.num} allenamento ${s.tipo}`;
  const list = s.tipo === "A" ? getEserciziA(s.round) : getEserciziB(s.round);

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
    nuoveRighe++;
  }
}

vault5.allenamenti = allenamenti;
fs.writeFileSync(VAULT_5_FILE, JSON.stringify(vault5, null, 2), "utf-8");
console.log(`✅ Vault 5 aggiornato con successo: aggiunte ${nuoveRighe} righe per il Ciclo 7.`);

// 2. Aggiorna demo-data.json
if (fs.existsSync(DEMO_DATA_FILE)) {
  const demoData = JSON.parse(fs.readFileSync(DEMO_DATA_FILE, "utf-8"));
  let demoAllenamenti = (demoData.allenamenti || []).filter((r) => r.settimana !== "Ciclo 7");
  demoAllenamenti.push(...ciclo7Rows);
  demoData.allenamenti = demoAllenamenti;
  fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(demoData, null, 2), "utf-8");
  console.log(`✅ demo-data.json sincronizzato con le ${nuoveRighe} righe del Ciclo 7.`);
}

// 3. Aggiorna api/index.js se presente sincronizzazione demo-data
if (fs.existsSync(API_INDEX_FILE)) {
  const apiContent = fs.readFileSync(API_INDEX_FILE, "utf-8");
  if (apiContent.includes("const demoData =")) {
    const demoDataStr = fs.readFileSync(DEMO_DATA_FILE, "utf-8");
    const demoObj = JSON.parse(demoDataStr);
    const updatedApi = apiContent.replace(
      /const demoData = \{[\s\S]*?\n\};\n\n\/\/ Helper/,
      `const demoData = ${JSON.stringify(demoObj, null, 2)};\n\n// Helper`
    );
    if (updatedApi !== apiContent) {
      fs.writeFileSync(API_INDEX_FILE, updatedApi, "utf-8");
      console.log(`✅ api/index.js sincronizzato con demoData.`);
    }
  }
}

// 4. Aggiorna registro_periodizzazione_pro.json
if (fs.existsSync(REGISTRO_PRO_FILE)) {
  const reg = JSON.parse(fs.readFileSync(REGISTRO_PRO_FILE, "utf-8"));
  reg.ciclo_attivo_da_pianificare = "Ciclo 8 (Mesociclo 3)";
  reg.mesociclo_attuale = "Mesociclo 3 (Cicli 7, 8, 9) - IN CORSO";
  if (!reg.storico_cicli) reg.storico_cicli = {};
  reg.storico_cicli["Ciclo 7"] = {
    status: "attivo / programmato",
    sessioni: 6,
    focus: "Avvio Mesociclo 3: Rientro Potenza & Hinge Fondamentale (COMBO Landmine Split Snatch H-H Switch, Landmine Coiled Deadlift), Underhand Matadors Wheel, Punch Isoinerziale, High Pull e Split Jumps in progressione 3 fasi",
  };

  const c7_used_ids = [
    "029", "099", "128", "042", "219", "105", "065", "089", "239",
    "047", "177", "056", "174", "028", "134", "229", "106", "227"
  ].map((id) => String(parseInt(id, 10)));

  for (const ex of reg.esercizi || []) {
    const eid = String(parseInt(ex.id, 10));
    if (c7_used_ids.includes(eid)) {
      ex.usage_count = (ex.usage_count || 0) + 1;
      ex.last_cycle_used = "Ciclo 7";
    }
  }

  const usati = (reg.esercizi || []).filter((e) => (e.usage_count || 0) > 0).length;
  reg.esercizi_utilizzati = usati;
  fs.writeFileSync(REGISTRO_PRO_FILE, JSON.stringify(reg, null, 2), "utf-8");
  console.log(`✅ Registro Periodizzazione PRO aggiornato: ${usati}/163 esercizi PRO sperimentati.`);
}
