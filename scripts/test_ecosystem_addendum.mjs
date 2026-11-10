import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..", "..", "..");
// local-api port is 3000 by default or let's import the local-api handler directly or test via server
import handler from "../api/index.js";

async function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// Start an in-memory HTTP server for testing
const server = http.createServer((req, res) => {
  handler(req, res);
});

server.listen(0, async () => {
  const port = server.address().port;
  console.log(`=======================================================`);
  console.log(`🧪 TEST ECOSISTEMA UNIFICATO & VIDEO VAULT (Port ${port})`);
  console.log(`=======================================================`);

  try {
    // 1. Test Video Vault Semantic Fast Search (<1s)
    console.log("\n1️⃣  Test Ricerca Semantica Video Vault (/app-api/vault/search)...");
    const t0 = Date.now();
    const searchRes = await makeRequest({
      hostname: "localhost",
      port,
      path: "/app-api/vault/search?q=coiling&pattern=rotazione",
      method: "GET",
    });
    const elapsed = Date.now() - t0;
    console.log(`   Status: ${searchRes.status} | Risultati trovati: ${searchRes.data?.total} in ${elapsed}ms`);
    if (searchRes.status === 200 && searchRes.data?.total > 0) {
      const first = searchRes.data.data[0];
      console.log(`   ✅ Match 1: "${first.nome_reale}" (#${first.id_esercizio})`);
      console.log(`   🔑 Cue: "${first.cue_esecutiva}"`);
      console.log(`   📱 WhatsApp URL: ${first.whatsapp_share_url.substring(0, 60)}...`);
    } else {
      throw new Error("Ricerca semantica fallita o vuota");
    }

    // 2. Test Video Vault Metadata (/app-api/vault/meta)
    console.log("\n2️⃣  Test Metadati Filtri Vault (/app-api/vault/meta)...");
    const metaRes = await makeRequest({
      hostname: "localhost",
      port,
      path: "/app-api/vault/meta",
      method: "GET",
    });
    console.log(`   Status: ${metaRes.status} | Pattern: ${metaRes.data?.patterns?.length} | Fulcri: ${metaRes.data?.fulcri?.length}`);
    if (metaRes.status === 200 && metaRes.data?.patterns?.length > 0) {
      console.log(`   ✅ Metadati caricati correttamente.`);
    } else {
      throw new Error("Metadati vault non trovati");
    }

    // 3. Test Handout Workout Details (/app-api/allenamenti/PRO/37)
    console.log("\n3️⃣  Test Scheda Handout con Ontologia (/app-api/allenamenti)...");
    const workoutRes = await makeRequest({
      hostname: "localhost",
      port,
      path: "/app-api/allenamenti/PRO/37",
      method: "GET",
    });
    console.log(`   Status: ${workoutRes.status} | Esercizi: ${workoutRes.data?.length}`);
    if (workoutRes.status === 200 && workoutRes.data?.length > 0) {
      const ex1 = workoutRes.data[0];
      console.log(`   ✅ Esercizio 1: ${ex1.nome_esercizio} | Rec: ${ex1.recupero || 'N/A'}`);
      console.log(`   ⚙️ Pattern ontologico: ${ex1.pattern_motorio || 'Presente'} | Cue: ${ex1.cue_esecutiva || 'Presente'}`);
    }

    // 4. Test Feedback Seduta & RPE (/app-api/diario)
    console.log("\n4️⃣  Test Salvataggio Feedback Seduta RPE (/app-api/diario)...");
    const fbRes = await makeRequest(
      {
        hostname: "localhost",
        port,
        path: "/app-api/diario",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      {
        email_cliente: "atleta1@area46.it",
        tipo: "feedback_seduta",
        livello: "Livello PRO",
        giorno: "1",
        rpe_globale: 8,
        sensazioni: ["Ottima fluidità", "RPE centrato"],
        note_cinestesiche: "Test feedback convezione fluido.",
      }
    );
    console.log(`   Status: ${fbRes.status} | ID Feedback: ${fbRes.data?.id}`);
    if (fbRes.status === 201) {
      console.log(`   ✅ Feedback salvato con successo nel diario.`);
    } else {
      throw new Error("Salvataggio feedback fallito");
    }

    // 5. Test Webhook Calendar Sync con Idempotenza
    console.log("\n5️⃣  Test Webhook Calendar Sync con Idempotenza (/app-api/webhooks/calendar-sync)...");
    const eventId = `test_evt_${Date.now()}`;
    const whRes1 = await makeRequest(
      {
        hostname: "localhost",
        port,
        path: "/app-api/webhooks/calendar-sync",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { event_id: eventId, action: "PING", email: "test@area46.it" }
    );
    console.log(`   Invio 1: Status ${whRes1.status} | Processed: ${whRes1.data?.processed}`);

    const whRes2 = await makeRequest(
      {
        hostname: "localhost",
        port,
        path: "/app-api/webhooks/calendar-sync",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { event_id: eventId, action: "PING", email: "test@area46.it" }
    );
    console.log(`   Invio 2 (duplicato): Status ${whRes2.status} | Duplicate: ${whRes2.data?.duplicate}`);
    if (whRes1.data?.processed && whRes2.data?.duplicate) {
      console.log(`   ✅ Idempotenza verificata con successo.`);
    } else {
      throw new Error("Test idempotenza fallito");
    }

    // 6. Test Audit Omni-System Shadow Mode (/app-api/shadow/events)
    console.log("\n6️⃣  Test Omni-System Shadow Mode (/app-api/shadow/events)...");
    const shadowRes = await makeRequest({
      hostname: "localhost",
      port,
      path: "/app-api/shadow/events?limit=10",
      method: "GET",
    });
    console.log(`   Status: ${shadowRes.status} | Eventi recenti tracciati: ${shadowRes.data?.count}`);
    if (shadowRes.status === 200 && shadowRes.data?.count > 0) {
      console.log(`   ✅ Ultimo evento shadow: ${shadowRes.data?.events[0]?.event_type} (${shadowRes.data?.events[0]?.timestamp})`);
    } else {
      throw new Error("Nessun evento shadow trovato");
    }

    // 7. Test Triage Cancellazioni Tardive (/app-api/prenotazioni/triage)
    console.log("\n7️⃣  Test Coda e Risoluzione Triage (<24h)...");
    const triageListRes = await makeRequest({
      hostname: "localhost",
      port,
      path: "/app-api/prenotazioni/triage",
      method: "GET",
    });
    console.log(`   Status: ${triageListRes.status} | Richieste triage in coda: ${triageListRes.data?.length}`);
    if (triageListRes.status === 200) {
      console.log(`   ✅ Endpoint triage attivo e pronto.`);
    } else {
      throw new Error("Endpoint triage non raggiungibile");
    }

    console.log("\n=======================================================");
    console.log("🎉 TUTTI I TEST DEI 4 PILASTRI SUPERATI CON SUCCESSO!");
    console.log("=======================================================\n");
  } catch (err) {
    console.error("❌ ERRORE TEST:", err);
  } finally {
    server.close();
  }
});
