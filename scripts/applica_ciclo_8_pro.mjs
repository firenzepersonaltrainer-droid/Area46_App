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

console.log("================================================================================");
console.log("🚀 APPLICAZIONE UFFICIALE CICLO 8 (MESOCICLO 3) — LIVELLO PRO (WARM UP VARIATO)");
console.log("================================================================================");

// Funzione generatrice Seduta A: 43 (round 1), 45 (round 2), 47 (round 3)
function getEserciziA(round) {
  const cableRowParam = round === 1 ? "4x10+10" : round === 2 ? "4x12+12" : "4x12+12";
  const deadbugParam = round === 1 ? "3x15-20" : round === 2 ? "3x18-20" : "3x20";
  const rowerParam = round === 1 ? '3x90"' : round === 2 ? '3x105"' : '3x120"';
  const rowerNote = round === 1 
    ? "circuito (3 round) | RPE 8 | condizionamento metabolico a cadenza costante (24-26 SPM)"
    : round === 2
    ? "circuito (3 round) | progressione intensità e tenuta metabolica (26-28 SPM)"
    : "circuito (3 round) | picco metabolico del ciclo a cadenza sostenuta (28-30 SPM)";

  return [
    {
      seq: "1a",
      id: "019",
      nome: "Ground mobility Series",
      param: "",
      rec: "",
      note: "dedica al massimo 8-9 minuti allo svolgimento dell’intera routine, ogni movimento ripetilo 6-10 volte",
      video: "https://youtu.be/3wZjPvwGt8U",
    },
    {
      seq: "1b",
      id: "025",
      nome: "Side Closing",
      param: "3x10+10",
      rec: '45"',
      note: "attivazione piano frontale con elastico, flessione laterale bacino su torace",
      video: "https://youtu.be/Z9bhpmPIRkM",
    },
    {
      seq: "2",
      id: "128",
      nome: "COMBO: Landmine Split snatch High hand switch T/GO",
      param: "4 X 6",
      rec: '75/90"',
      note: "Svolgi 2-4 serie di avvicinamento prima della serie allenante | RPE 8.5",
      video: "https://youtube.com/shorts/I9GYUvD_Ink",
    },
    {
      seq: "3a",
      id: "023",
      nome: "Coiled Cable ROW",
      param: cableRowParam,
      rec: "",
      note: "jump set | RPE 8 | esegui lo stesso movimento di braccia che si ha nella blade position, portando la mano a fianco del mento",
      video: "https://youtu.be/OdhNUbqajmM",
    },
    {
      seq: "3b",
      id: "219",
      nome: "Punch isoinerziale",
      param: '4x40"+40"',
      rec: '60"',
      note: "jump set | RPE 8 | spinta rotazionale continua del tronco ed economia del gesto",
      video: "https://youtu.be/-j07Q_jaTOA",
    },
    {
      seq: "4",
      id: "242",
      nome: "Underhand/Overhand Matador Transitions",
      param: "1x5'",
      rec: '60"',
      note: "Heavy Rope flow: traiettoria circolare continua sotto mano, rotazione scapolo-omerale e stabilità pelvica",
      video: "https://www.youtube.com/watch?v=4k2O1hameP0",
    },
    {
      seq: "5",
      id: "207",
      nome: "Seated Endless rope power pull",
      param: '4x40"',
      rec: '60"',
      note: "Consolidato | RPE 8 | trazione continua endless rope da seduto, stabilità del bacino ed economia del gesto",
      video: "https://youtube.com/shorts/8QVxs6WyGJs",
    },
    {
      seq: "6a",
      id: "089",
      nome: "Deadbug",
      param: deadbugParam,
      rec: "",
      note: "circuito (3 round) | anti-estensione lombare con fitball e core stability",
      video: "https://youtu.be/b4InDUstH8Y?si=NP68qp2ACf_YIo2-",
    },
    {
      seq: "6b",
      id: "243",
      nome: "vogatore",
      param: rowerParam,
      rec: '60"',
      note: rowerNote,
      video: "https://youtube.com/shorts/LJtEOWOPcs0?si=M8nmE_1THh0Gj20a",
    },
  ];
}

// Funzione generatrice Seduta B: 44 (round 1), 46 (round 2), 48 (round 3)
function getEserciziB(round) {
  const amrapTime = round === 1 ? "10'" : round === 2 ? "11'" : "13'";
  const skyergLungesParam = round === 1 ? "x 10+10" : round === 2 ? "x 12+12" : "x 15+15";

  const baseList = [
    {
      seq: "1a",
      id: "030",
      nome: "Wall Stretch",
      param: '3 X 45"',
      rec: "",
      note: "tri-set | apertura toracica e allungamento miofasciale a parete | tenere la posizione per circa 6/8 cicli respiratori profondi e controllati",
      video: "https://youtube.com/shorts/SYXUt6RuHAU",
    },
    {
      seq: "1b",
      id: "047",
      nome: "wall driver",
      param: '3 X 45"',
      rec: "",
      note: "tri-set | movimento alternato continuo a tempo | spinta diagonale a parete, spalla e core",
      video: "https://youtube.com/shorts/xK2pqjLUPl4",
    },
    {
      seq: "1c",
      id: "158",
      nome: "Bat around the head 90° e 180°",
      param: '3 X 45"',
      rec: '45"',
      note: "tri-set | utilizzare una clava leggera per le prime volte, per abituare i polsi al movimento senza stressarli troppo | rotazione a spirale della spalla su bacino a 90° e 180°",
      video: "https://youtu.be/INNpiEJL9As?si=7-xSjR1LJL__jzU8",
    },
    {
      seq: "2",
      id: "056",
      nome: "Landmine coiled Deadlift",
      param: "4x5+5",
      rec: 'RBS 75"',
      note: "RPE 8.5 | svolgi adeguate serie di avvicinamento prima delle serie allenanti che dovranno arrivare ad RPE 8.5",
      video: "https://youtu.be/q8pfMEqSrm8",
    },
    {
      seq: "3a",
      id: "174",
      nome: "DB/Kett split snatch",
      param: "4x5+5",
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
      param: "4x6+6",
      rec: 'RBS 30" - Rest 60"',
      note: "RPE 8 (se il movimento è incerto non tenere conto dell’RPE indicato, concentrati sugli aspetti tecnici) | inizia dal lato più debole e ricorda di alternare il lato di partenza ad ogni seduta",
      video: "https://youtube.com/shorts/b1DU11BZKCk",
    },
  ];

  if (round === 1) {
    // 1° Allenamento B (Seduta 44): Dragon Roll dedicato (5 minuti) per apprendimento motorio e fluidità; nell'AMRAP gli altri due esercizi con jumping rope
    return [
      ...baseList,
      {
        seq: "5",
        id: "106",
        nome: "Dragon Roll",
        param: "1x5'",
        rec: '60"',
        note: "pratica dedicata: 5 minuti continui per acquisire padronanza, ritmo e fluidità motoria con il Flow Rope",
        video: "https://youtu.be/I3Jpk2S2bRE?si=IkQQs9ghbHbBufWV",
      },
      {
        seq: "6a",
        id: "229",
        nome: "Split Clean T&go",
        param: "x 6+6",
        rec: "",
        note: "AMRAP 10' | cadenza continua e stabilità nello split",
        video: "https://youtube.com/shorts/PQ-Ga27AgoM",
      },
      {
        seq: "6b",
        id: "102",
        nome: "jumping rope",
        param: "50 rep",
        rec: "",
        note: "AMRAP 10' | saltelli continui a ritmo costante (in alternativa jumping jack per chi non ha corda o fluidità)",
        video: "",
      },
      {
        seq: "6c",
        id: "227",
        nome: "skierg lunges alternati",
        param: skyergLungesParam,
        rec: "",
        note: "AMRAP 10' | **NB: sia con sbarra a destra che a sinistra svolgi affondi dietro alternati**",
        video: "https://youtube.com/shorts/kYfL3_rgym8",
      },
    ];
  }

  // 2° e 3° Allenamento B (Sedute 46 e 48): AMRAP originario con Dragon Roll a 50 rep al giro
  return [
    ...baseList,
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
      param: "50 rep",
      rec: "",
      note: `AMRAP ${amrapTime} | 50 ripetizioni al giro: rotazione dinamica Flow Rope a ritmo fluido e continuo`,
      video: "https://youtu.be/I3Jpk2S2bRE?si=IkQQs9ghbHbBufWV",
    },
    {
      seq: "5c",
      id: "227",
      nome: "skierg lunges alternati",
      param: skyergLungesParam,
      rec: "",
      note: `AMRAP ${amrapTime} | **NB: sia con sbarra a destra che a sinistra svolgi affondi dietro alternati**`,
      video: "https://youtube.com/shorts/kYfL3_rgym8",
    },
  ];
}

// 1. CARICAMENTO E AGGIORNAMENTO VAULT 5
const vault5 = JSON.parse(fs.readFileSync(VAULT_5_FILE, "utf-8"));
let allenamenti = vault5.allenamenti || [];

// Idempotenza: rimuovi eventuali righe già presenti di Ciclo 8
allenamenti = allenamenti.filter((r) => r.settimana !== "Ciclo 8");

let nextId = allenamenti.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;

const plan = [
  { num: 43, tipo: "A", round: 1 },
  { num: 44, tipo: "B", round: 1 },
  { num: 45, tipo: "A", round: 2 },
  { num: 46, tipo: "B", round: 2 },
  { num: 47, tipo: "A", round: 3 },
  { num: 48, tipo: "B", round: 3 },
];

let nuoveRighe = 0;
const ciclo8Rows = [];

for (const s of plan) {
  const giornoStr = `${s.num} allenamento ${s.tipo}`;
  const list = s.tipo === "A" ? getEserciziA(s.round) : getEserciziB(s.round);

  for (const ex of list) {
    const row = {
      id: nextId++,
      livello: "PRO",
      settimana: "Ciclo 8",
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
    ciclo8Rows.push(row);
    nuoveRighe++;
  }
}

vault5.allenamenti = allenamenti;
fs.writeFileSync(VAULT_5_FILE, JSON.stringify(vault5, null, 2), "utf-8");
console.log(`✅ Vault 5 aggiornato con successo: ${nuoveRighe} righe per il Ciclo 8 (Seduta A: 9 stazioni, Seduta B: 10 stazioni).`);

// 2. AGGIORNAMENTO DEMO-DATA.JSON
if (fs.existsSync(DEMO_DATA_FILE)) {
  const demoData = JSON.parse(fs.readFileSync(DEMO_DATA_FILE, "utf-8"));
  let demoAllenamenti = (demoData.allenamenti || []).filter((r) => r.settimana !== "Ciclo 8");
  demoAllenamenti.push(...ciclo8Rows);
  demoData.allenamenti = demoAllenamenti;
  fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(demoData, null, 2), "utf-8");
  console.log(`✅ demo-data.json sincronizzato con le ${nuoveRighe} righe del Ciclo 8.`);
}

// 3. AGGIORNAMENTO REGISTRO PERIODIZZAZIONE PRO
if (fs.existsSync(REGISTRO_PRO_FILE)) {
  const reg = JSON.parse(fs.readFileSync(REGISTRO_PRO_FILE, "utf-8"));
  reg.ciclo_attivo_da_pianificare = "Ciclo 9 (Mesociclo 3 - Scarico Mod. B)";
  reg.mesociclo_attuale = "Mesociclo 3 (Cicli 7, 8, 9) - IN CORSO";
  if (!reg.storico_cicli) reg.storico_cicli = {};
  reg.storico_cicli["Ciclo 8"] = {
    status: "attivo / programmato",
    sessioni: 6,
    focus: "Picco Mesociclo 3: Varietà Warm Up (Ground Mobility Series + Side Closing in A; Tri-set Wall Stretch 3x45\" con cicli respiratori + Wall Driver 3x45\" + Bat around head 3x45\" in B), Intensificazione Fondamentali RPE 8.5 (COMBO Split Snatch H-H Switch 4x6, Landmine Coiled Deadlift 4x5+5), Seated Endless Rope Power Pull 4x40\", Aerial Jerk 4x6+6 (RBS 30\" - Rest 60\"), Punch Isoinerziale, Matador Transitions e AMRAP progressivo 10'-11'-13' (Dragon Roll 5' dedicato in B1 e 50 rep al giro in B2/B3; skierg lunges alternati)",
  };

  const c8_used_ids = [
    "019", "025", "128", "023", "219", "242", "207", "089", "243",
    "030", "047", "158", "056", "174", "028", "120", "229", "106", "102", "227"
  ].map((id) => String(parseInt(id, 10)));

  for (const ex of reg.esercizi || []) {
    const eid = String(parseInt(ex.id, 10));
    if (c8_used_ids.includes(eid)) {
      ex.usage_count = (ex.usage_count || 0) + 1;
      ex.last_cycle_used = "Ciclo 8";
    }
  }

  const usati = (reg.esercizi || []).filter((e) => (e.usage_count || 0) > 0).length;
  reg.esercizi_utilizzati = usati;
  fs.writeFileSync(REGISTRO_PRO_FILE, JSON.stringify(reg, null, 2), "utf-8");
  console.log(`✅ Registro Periodizzazione PRO aggiornato: ${usati}/164 esercizi PRO sperimentati.`);
}

console.log("================================================================================");
console.log("🎯 CICLO 8 APPLICATO CON SUCCESSO");
console.log("================================================================================");
