import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const VAULT_5_FILE = path.join(ROOT_DIR, "data", "vault", "5_metodologia_allenamenti_cicli.json");
const REGISTRO_PRO_FILE = path.join(ROOT_DIR, "registro_periodizzazione_pro.json");

// Esercizi Seduta A con progressione A1, A2, A3
function getEserciziA(round) {
  const base = [
    {
      seq: "1a",
      id: "162",
      nome: "Bat Circular Throw 180°",
      param: '3x60"+60"',
      rec: "",
      note: "jump set | utilizzare una clava leggera per le prime volte, per abituare i polsi al movimento senza stressarli troppo",
      video: "https://youtu.be/ZfYjQ659bMo?si=5CtK6H1ghOXZfBbz",
    },
    {
      seq: "1b",
      id: "131",
      nome: "A-Skip",
      param: '3x20"+20"',
      rec: '45"',
      note: "jump set",
      video: "https://youtu.be/VRlw2TrsPvo?si=oS5PrWbJhfK_C9MA",
    },
    {
      seq: "2",
      id: "208",
      nome: "Landmine Plyo Lift NO DOWN",
      param: "4x6+6",
      rec: 'RBS 60"',
      note: "RPE 7.5 | scarico selettivo Mod. B, focus velocità e assorbimento elastico",
      video: "https://youtube.com/shorts/7r3ThD-zkpw",
    },
    {
      seq: "3a",
      id: "077",
      nome: "Coiled Punch isoinerziale",
      param: '4x40"+40"',
      rec: "",
      note: "jump set | RPE 8",
      video: "https://youtube.com/shorts/mifz_6oZJlw",
    },
    {
      seq: "3b",
      id: "097",
      nome: "Endless rope Plank Alternating Pull",
      param: '4x20"',
      rec: '60"',
      note: "jump set | RPE 8",
      video: "https://youtube.com/shorts/gcgilJEmzks",
    },
    {
      seq: "4",
      id: "104",
      nome: "Overhand Matadors Wheel",
      param: "1x5'",
      rec: '60"',
      note: "Heavy Rope flow, coordinazione scapolo-omerale e destrezza",
      video: "https://youtu.be/7dzFrsIVT7Q?si=8CfEDPP5L0mXNdHD",
    },
  ];

  if (round === 1) {
    // Seduta 31: separati per studio didattico
    base.push(
      {
        seq: "5a",
        id: "130",
        nome: "cross jump double touch",
        param: '3x30"',
        rec: '45"',
        note: "destrezza e reattività piedi, isolato per studio motorio",
        video: "https://youtu.be/PTciDyczhB8?si=7nmq5vZHDumttcyM",
      },
      {
        seq: "5b",
        id: "090",
        nome: "dragon flag progressioni",
        param: "3x6-8",
        rec: '60"',
        note: "trovare sempre la versione che permette nel nr di rep indicato un RPE di 8",
        video: "https://youtu.be/LjHUx2MFcR8",
      },
      {
        seq: "5c",
        id: "007",
        nome: "Coiled skyerg",
        param: '3x30"+30"',
        rec: '60"',
        note: "integrazione spiralizzata",
        video: "https://youtube.com/shorts/hML7iVaIBaU",
      }
    );
  } else if (round === 2) {
    // Seduta 33: uniti in circuito con cross jump a 60"
    base.push(
      {
        seq: "5a",
        id: "130",
        nome: "cross jump double touch",
        param: '3x60"',
        rec: "",
        note: 'circuito (3 round) | estensione tempo a 60"',
        video: "https://youtu.be/PTciDyczhB8?si=7nmq5vZHDumttcyM",
      },
      {
        seq: "5b",
        id: "090",
        nome: "dragon flag progressioni",
        param: "3x6-8",
        rec: "",
        note: "circuito (3 round) | trovare sempre la versione che permette nel nr di rep indicato un RPE di 8",
        video: "https://youtu.be/LjHUx2MFcR8",
      },
      {
        seq: "5c",
        id: "007",
        nome: "Coiled skyerg",
        param: '3x30"+30"',
        rec: '60"',
        note: "circuito (3 round)",
        video: "https://youtube.com/shorts/hML7iVaIBaU",
      }
    );
  } else {
    // Seduta 35: uniti in circuito con cross jump a 45"
    base.push(
      {
        seq: "5a",
        id: "130",
        nome: "cross jump double touch",
        param: '3x45"',
        rec: "",
        note: 'circuito (3 round) | ricalibrato a 45" ad alta cadenza',
        video: "https://youtu.be/PTciDyczhB8?si=7nmq5vZHDumttcyM",
      },
      {
        seq: "5b",
        id: "090",
        nome: "dragon flag progressioni",
        param: "3x6-8",
        rec: "",
        note: "circuito (3 round) | trovare sempre la versione che permette nel nr di rep indicato un RPE di 8",
        video: "https://youtu.be/LjHUx2MFcR8",
      },
      {
        seq: "5c",
        id: "007",
        nome: "Coiled skyerg",
        param: '3x30"+30"',
        rec: '60"',
        note: "circuito (3 round)",
        video: "https://youtube.com/shorts/hML7iVaIBaU",
      }
    );
  }

  return base;
}

// Esercizi Seduta B con progressione B1 (32), B2 (34), B3 (36)
function getEserciziB(round) {
  const amrapTime = round === 1 ? "10'" : round === 2 ? "11'" : "13'";
  const woodChopperParam = round === 1 ? "x 15+15" : round === 2 ? "x 20+20" : "x 25+25";

  let kneeDrivesParam = '3x20"+20"';
  let kneeDrivesNote = "reattività elastica, footwork e rimbalzo";
  if (round === 1) {
    kneeDrivesParam = "costruzione motoria";
    kneeDrivesNote = "costruzione dell’esercizio: dedica il tempo necessario all’apprendimento motorio. Chiedi al coach una progressione adeguata al tuo livello";
  } else if (round === 2) {
    kneeDrivesParam = "4x10";
    kneeDrivesNote = "lavora con calma e lentezza, dai la precedenza alla tecnica anziché sull’intensità";
  } else {
    kneeDrivesParam = '3x20"+20"';
    kneeDrivesNote = "cerca la massima esplosività adeguata al tuo livello";
  }

  return [
    {
      seq: "1a",
      id: "033",
      nome: "Coiled Cobra",
      param: '3x30"-40"',
      rec: "",
      note: "jump set | esercizio alternato continuo, mai monolaterale",
      video: "https://youtube.com/shorts/GU3ePuvJwMk",
    },
    {
      seq: "1b",
      id: "160",
      nome: "Bat Circular Throw",
      param: '3x60"+60"',
      rec: '45"',
      note: "jump set | senza pausa tra i lati | utilizzare una clava leggera per le prime volte, per abituare i polsi al movimento senza stressarli troppo",
      video: "https://youtu.be/oWM6pwB1Zrc?si=gePKc-R65kniEnh2",
    },
    {
      seq: "2a",
      id: "061",
      nome: "Kettlebell Step clean",
      param: '4x60"+60"',
      rec: "",
      note: "jump set | RPE 7.5 | senza pausa tra i lati | scarico selettivo Mod. B",
      video: "https://youtu.be/DajheBayHjc",
    },
    {
      seq: "2b",
      id: "182",
      nome: "Diagonal Clubbell T/S",
      param: '4x60"+60"',
      rec: 'RBS 60"',
      note: "jump set | senza pausa tra i lati | utilizzare una clava leggera per le prime volte, per abituare i polsi al movimento senza stressarli troppo",
      video: "https://youtu.be/Oym9Ibkkh1E?si=_eMoPUPN9PP_AqAY",
    },
    {
      seq: "3a",
      id: "028",
      nome: "Transverse hold",
      param: '4x30"+30"',
      rec: "",
      note: "jump set | creare contro-rotazione del bacino su torace (chiedi all’istruttore)",
      video: "https://youtu.be/aJ98KT13FtE?si=Li6fp-kbyh4wCnfT",
    },
    {
      seq: "3b",
      id: "180",
      nome: "Single Dumbbell Pendulum lunge",
      param: '4x30"+30"',
      rec: 'RBS 45"',
      note: "jump set | RPE 8 (se il movimento è incerto non tenere conto dell’RPE indicato, concentrati sugli aspetti tecnici)",
      video: "https://youtu.be/mgABr0Ss9Fo?si=Hwr_UXlnHTfTy_Wk",
    },
    {
      seq: "4",
      id: "240",
      nome: "Knee drives",
      param: kneeDrivesParam,
      rec: '45"',
      note: kneeDrivesNote,
      video: "https://www.youtube.com/shorts/2LBsvhVglwA",
    },
    {
      seq: "5a",
      id: "070",
      nome: "Dumbbell Split Snatch",
      param: "x 6+6",
      rec: "",
      note: `AMRAP ${amrapTime}`,
      video: "https://youtu.be/rE8lJ9TxbEQ",
    },
    {
      seq: "5b",
      id: "091",
      nome: "Elbow Spiderman Toe Tap",
      param: "x 8+8",
      rec: "",
      note: `AMRAP ${amrapTime}`,
      video: "https://youtu.be/ktgDSN7EnhI",
    },
    {
      seq: "5c",
      id: "004",
      nome: "Skierg wood chopper",
      param: woodChopperParam,
      rec: "",
      note: `AMRAP ${amrapTime}`,
      video: "https://youtube.com/shorts/7n-hAJAXoYU",
    },
  ];
}

// Carica Vault 5
const vault5 = JSON.parse(fs.readFileSync(VAULT_5_FILE, "utf-8"));
let allenamenti = vault5.allenamenti || [];

// Rimuovi eventuali righe già presenti di Ciclo 6 per idempotenza
allenamenti = allenamenti.filter((r) => r.settimana !== "Ciclo 6");

let nextId = allenamenti.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;

const plan = [
  { num: 31, tipo: "A", round: 1 },
  { num: 32, tipo: "B", round: 1 },
  { num: 33, tipo: "A", round: 2 },
  { num: 34, tipo: "B", round: 2 },
  { num: 35, tipo: "A", round: 3 },
  { num: 36, tipo: "B", round: 3 },
];

let nuoveRighe = 0;
for (const s of plan) {
  const giornoStr = `${s.num} allenamento ${s.tipo}`;
  const list = s.tipo === "A" ? getEserciziA(s.round) : getEserciziB(s.round);

  for (const ex of list) {
    allenamenti.push({
      id: nextId++,
      livello: "PRO",
      settimana: "Ciclo 6",
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
    });
    nuoveRighe++;
  }
}

vault5.allenamenti = allenamenti;
fs.writeFileSync(VAULT_5_FILE, JSON.stringify(vault5, null, 2), "utf-8");
console.log(`✅ Vault 5 aggiornato con successo: aggiunte ${nuoveRighe} righe per il Ciclo 6.`);

// Aggiorna registro_periodizzazione_pro.json
if (fs.existsSync(REGISTRO_PRO_FILE)) {
  const reg = JSON.parse(fs.readFileSync(REGISTRO_PRO_FILE, "utf-8"));
  reg.ciclo_attivo_da_pianificare = "Ciclo 7 (Inizio Mesociclo 3)";
  if (!reg.storico_cicli) reg.storico_cicli = {};
  reg.storico_cicli["Ciclo 6"] = {
    status: "attivo / programmato",
    sessioni: 6,
    focus: "Chiusura Mesociclo 2: Scarico Selettivo Mod. B, Heavy Rope Flow 1x5', Bat Circular 60\"+60\", Coiled Punch Isoinerziale 40\"+40\", Pliometria e Stabilità Asimmetrica",
  };
  fs.writeFileSync(REGISTRO_PRO_FILE, JSON.stringify(reg, null, 2), "utf-8");
  console.log(`✅ Registro Periodizzazione PRO aggiornato con Ciclo 6.`);
}
