import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const VAULT_4_FILE = path.join(ROOT_DIR, "data", "vault", "4_metodologia_esercizi.json");
const VAULT_5_FILE = path.join(ROOT_DIR, "data", "vault", "5_metodologia_allenamenti_cicli.json");
const REGISTRO_FILE = path.join(ROOT_DIR, "registro_periodizzazione_pro.json");
const DEMO_DATA_FILE = path.join(ROOT_DIR, "demo-data.json");
const BRIDGE_FILE = path.join(ROOT_DIR, "data", "vault", "ponte_database_esercizi_universale.json");

console.log("=== PERFEZIONAMENTO CICLO 7: BAND HIP CIRCUIT + ELIMINAZIONE GYMNASTY ABS + DRAGON FLAG ===");

// 1. ELIMINAZIONE DEFINITIVA DI GYMNASTY ABS DA VAULT 4
const vault4 = JSON.parse(fs.readFileSync(VAULT_4_FILE, "utf-8"));
const exCountPrima = (vault4.database_esercizi || []).length;
vault4.database_esercizi = (vault4.database_esercizi || []).filter((ex) => {
  const eid = String(ex.id_esercizio).padStart(3, "0");
  const nome = (ex.nome_reale || "").toLowerCase();
  return eid !== "239" && !nome.includes("gymnasty");
});
fs.writeFileSync(VAULT_4_FILE, JSON.stringify(vault4, null, 2), "utf-8");
console.log(`✅ Vault 4: Gymnasty ABS eliminato definitivamente (${exCountPrima} -> ${vault4.database_esercizi.length} esercizi).`);

// 2. ELIMINAZIONE DA DEMO-DATA.JSON
if (fs.existsSync(DEMO_DATA_FILE)) {
  const demoData = JSON.parse(fs.readFileSync(DEMO_DATA_FILE, "utf-8"));
  demoData.esercizi = (demoData.esercizi || []).filter((ex) => {
    const eid = String(ex.id_esercizio).padStart(3, "0");
    const nome = (ex.nome_reale || "").toLowerCase();
    return eid !== "239" && !nome.includes("gymnasty");
  });
  fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(demoData, null, 2), "utf-8");
  console.log(`✅ demo-data.json: Gymnasty ABS eliminato dal catalogo.`);
}

// 3. ELIMINAZIONE DA BRIDGE UNIVERSALE
if (fs.existsSync(BRIDGE_FILE)) {
  const bridge = JSON.parse(fs.readFileSync(BRIDGE_FILE, "utf-8"));
  bridge.mappatura = (bridge.mappatura || []).filter((m) => {
    const eid = String(m.id_area46).padStart(3, "0");
    const nome = (m.nome_area46 || "").toLowerCase();
    return eid !== "239" && !nome.includes("gymnasty");
  });
  bridge.totale_esercizi = bridge.mappatura.length;
  fs.writeFileSync(BRIDGE_FILE, JSON.stringify(bridge, null, 2), "utf-8");
  console.log(`✅ Ponte Universale: ID 239 rimosso.`);
}

// 4. ELIMINAZIONE DA REGISTRO PERIODIZZAZIONE PRO
if (fs.existsSync(REGISTRO_FILE)) {
  const reg = JSON.parse(fs.readFileSync(REGISTRO_FILE, "utf-8"));
  reg.esercizi = (reg.esercizi || []).filter((e) => {
    const eid = String(e.id).padStart(3, "0");
    const nome = (e.nome || "").toLowerCase();
    return eid !== "239" && !nome.includes("gymnasty");
  });
  reg.totale_esercizi_catalogo = reg.esercizi.length;
  fs.writeFileSync(REGISTRO_FILE, JSON.stringify(reg, null, 2), "utf-8");
  console.log(`✅ Registro Periodizzazione: Gymnasty ABS rimosso dal catalogo PRO.`);
}

// 5. APPLICAZIONE MODIFICHE CICLO 7 IN VAULT 5
const vault5 = JSON.parse(fs.readFileSync(VAULT_5_FILE, "utf-8"));
let modCount = 0;

for (const a of vault5.allenamenti || []) {
  if (a.settimana === "Ciclo 7" && ["37 allenamento A", "39 allenamento A", "41 allenamento A"].includes(a.giorno)) {
    // Sostituzione 1b: Side move -> Band hip Circuit
    if (a.sequenza === "1b") {
      a.id_esercizio = "021";
      a.nome_esercizio = "Band hip Circuit";
      a.parametri = "3x10+10";
      a.recupero = '45"';
      a.note_tecniche = "jump set | attivazione glutea e mobilità anca con elastico a freddo";
      a.link_video = "https://youtu.be/jiVtzTAmp40";
      modCount++;
    }
    // Inserimento 6b: dragon flag progressioni
    if (a.sequenza === "6b") {
      a.id_esercizio = "090";
      a.nome_esercizio = "dragon flag progressioni";
      a.parametri = "3x6-8";
      a.recupero = '60"';
      a.note_tecniche = "circuito (3 round) | trovare sempre la versione che permette nel nr di rep indicato un RPE di 8";
      a.link_video = "https://youtube.com/shorts/Ye_FV7ti41k";
      modCount++;
    }
  }
}

fs.writeFileSync(VAULT_5_FILE, JSON.stringify(vault5, null, 2), "utf-8");
console.log(`✅ Vault 5: Aggiornate ${modCount} righe in Ciclo 7 (Band hip Circuit e dragon flag).`);

// 6. SINCRONIZZA ALLENAMENTI IN DEMO-DATA.JSON
if (fs.existsSync(DEMO_DATA_FILE)) {
  const demoData = JSON.parse(fs.readFileSync(DEMO_DATA_FILE, "utf-8"));
  let demoAllenamenti = (demoData.allenamenti || []).filter((r) => r.settimana !== "Ciclo 7");
  const c7Rows = (vault5.allenamenti || []).filter((r) => r.settimana === "Ciclo 7");
  demoAllenamenti.push(...c7Rows);
  demoData.allenamenti = demoAllenamenti;
  fs.writeFileSync(DEMO_DATA_FILE, JSON.stringify(demoData, null, 2), "utf-8");
  console.log(`✅ demo-data.json: Sincronizzato con Ciclo 7 definitivo.`);
}

// 7. AGGIORNA REGISTRO PERIODIZZAZIONE PRO PER USAGE COUNT
if (fs.existsSync(REGISTRO_FILE)) {
  const reg = JSON.parse(fs.readFileSync(REGISTRO_FILE, "utf-8"));
  // Aggiorna usage di Band hip Circuit (021) e dragon flag (090)
  for (const ex of reg.esercizi || []) {
    const eid = String(parseInt(ex.id, 10));
    if (eid === "21") {
      ex.usage_count = (ex.usage_count || 0) + 1;
      ex.last_cycle_used = "Ciclo 7";
    }
    if (eid === "90") {
      ex.usage_count = (ex.usage_count || 0) + 1;
      ex.last_cycle_used = "Ciclo 7";
    }
    // Side move (074) non è usato in Ciclo 7
    if (eid === "74" && ex.last_cycle_used === "Ciclo 7") {
      ex.usage_count = Math.max(1, (ex.usage_count || 1) - 1);
      ex.last_cycle_used = "Ciclo 4";
    }
  }
  const usati = (reg.esercizi || []).filter((e) => (e.usage_count || 0) > 0).length;
  reg.esercizi_utilizzati = usati;
  fs.writeFileSync(REGISTRO_FILE, JSON.stringify(reg, null, 2), "utf-8");
  console.log(`✅ Registro Periodizzazione: conteggi aggiornati (${usati} esercizi utilizzati).`);
}
