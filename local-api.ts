import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

const DATA_FILE = path.resolve(__dirname, "demo-data.json");

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      livelli: [],
      ordine_livelli: [],
      database_esercizi: [],
      allenamenti: [],
      diario_utente: [],
      stato_allenamenti: [],
      preferenze_utente: [],
    };
  }
}

function saveData(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Errore salvataggio demo-data:", err);
  }
}

let db = loadData();

const DEMO_USER = {
  id: "demo-coach-46",
  email: "coach@area46.it",
  name: "Coach Area46",
};

export function handleLocalApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  db = loadData();
  const url = new URL(req.url ?? "/", "http://localhost:5173");
  const pathname = url.pathname;
  const method = req.method?.toUpperCase() ?? "GET";

  if (!pathname.startsWith("/app-api")) {
    return next();
  }

  res.setHeader("Content-Type", "application/json");

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    let parsedBody: any = {};
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = {};
      }
    }

    // 1. Livelli
    if (pathname === "/app-api/livelli" && method === "GET") {
      const livelli = db.livelli || [];
      return res.end(JSON.stringify(livelli));
    }

    // 2. Allenamenti (lista giorni)
    if (pathname === "/app-api/allenamenti" && method === "GET") {
      const livello = url.searchParams.get("livello");
      let all = db.allenamenti.filter(
        (a: any) =>
          a.giorno !== null &&
          ((a.nome_esercizio && a.nome_esercizio.trim() !== "") ||
            (a.id_esercizio && a.id_esercizio.trim() !== "")),
      );
      if (livello) {
        all = all.filter((a: any) => a.livello === livello);
      }

      // Raggruppa per giorno e settimana
      const map = new Map<string, any>();
      for (const row of all) {
        const numMatch = String(row.giorno).match(/[0-9]+/);
        const giorno_num = numMatch ? parseInt(numMatch[0], 10) : 1;
        const key = `${row.livello ?? ""}-${row.settimana ?? ""}-${giorno_num}`;
        if (!map.has(key)) {
          map.set(key, {
            livello: row.livello,
            giorno: row.giorno,
            settimana: row.settimana || "Ciclo unico",
            giorno_num,
          });
        }
      }
      const results = Array.from(map.values()).sort((a, b) => {
        if (a.settimana !== b.settimana) return a.settimana.localeCompare(b.settimana, undefined, { numeric: true });
        return a.giorno_num - b.giorno_num;
      });
      return res.end(JSON.stringify(results));
    }

    // 3. Approfondimenti
    if (pathname === "/app-api/approfondimenti" && method === "GET") {
      const rows = db.allenamenti
        .filter((a: any) => a.livello === "Approfondimenti ed extra")
        .map((a: any) => ({
          nome_esercizio: a.nome_esercizio,
          note_tecniche: a.note_tecniche,
          link_video: a.link_video,
          data_pubblicazione: a.data_pubblicazione ?? null,
        }));
      return res.end(JSON.stringify(rows));
    }

    // 4. Dettaglio Giorno: /app-api/allenamenti/:livello/:giorno
    const dettaglioMatch = pathname.match(/^\/app-api\/allenamenti\/([^/]+)\/([^/]+)$/);
    if (dettaglioMatch && method === "GET") {
      const targetLivello = decodeURIComponent(dettaglioMatch[1]);
      const targetGiorno = parseInt(dettaglioMatch[2], 10);

      const rows = db.allenamenti
        .filter((a: any) => {
          if (a.livello !== targetLivello) return false;
          const m = String(a.giorno).match(/[0-9]+/);
          const gNum = m ? parseInt(m[0], 10) : NaN;
          return gNum === targetGiorno;
        })
        .map((a: any) => {
          const exInfo = db.database_esercizi.find(
            (de: any) => String(de.id_esercizio).padStart(3, "0") === String(a.id_esercizio).padStart(3, "0")
          );
          return {
            ...a,
            link_video: a.link_video || exInfo?.link_video || "",
          };
        });
      return res.end(JSON.stringify(rows));
    }

    // 5. Singolo esercizio: /app-api/esercizi/:idEsercizio
    const exMatch = pathname.match(/^\/app-api\/esercizi\/([^/]+)$/);
    if (exMatch && method === "GET") {
      const idEsercizio = decodeURIComponent(exMatch[1]);
      const row = db.database_esercizi.find(
        (e: any) => String(e.id_esercizio).padStart(3, "0") === String(idEsercizio).padStart(3, "0")
      );
      return res.end(JSON.stringify(row || null));
    }

    // 6. Libreria
    if (pathname === "/app-api/libreria" && method === "GET") {
      const attrezzo = url.searchParams.get("attrezzo");
      const q = url.searchParams.get("q")?.toLowerCase();

      let rows = db.database_esercizi || [];
      if (attrezzo) {
        rows = rows.filter((e: any) => e.attrezzo === attrezzo);
      }
      if (q) {
        rows = rows.filter(
          (e: any) =>
            e.nome_reale.toLowerCase().includes(q) ||
            (e.tag_biomeccanici && e.tag_biomeccanici.toLowerCase().includes(q)) ||
            (e.attrezzo && e.attrezzo.toLowerCase().includes(q)),
        );
      }
      return res.end(JSON.stringify(rows));
    }

    // 7. Attrezzi
    if (pathname === "/app-api/libreria/attrezzi" && method === "GET") {
      const attrezzi = Array.from(
        new Set(db.database_esercizi.map((e: any) => e.attrezzo).filter(Boolean))
      ).sort();
      return res.end(JSON.stringify(attrezzi));
    }

    // 8. Stati: GET /app-api/stati
    if (pathname === "/app-api/stati" && method === "GET") {
      const rows = db.stato_allenamenti.filter((s: any) => s.email_cliente === DEMO_USER.email);
      return res.end(JSON.stringify(rows));
    }

    // 9. Reset preview: GET /app-api/stati/reset-preview
    if (pathname === "/app-api/stati/reset-preview" && method === "GET") {
      const targetLivello = url.searchParams.get("livello") ?? "";
      const targetGiorno = parseInt(url.searchParams.get("giorno") ?? "0", 10);

      const eserciziGiorno = db.allenamenti
        .filter((a: any) => {
          if (a.livello !== targetLivello) return false;
          const m = String(a.giorno).match(/[0-9]+/);
          return m && parseInt(m[0], 10) === targetGiorno;
        })
        .map((a: any) => a.id_esercizio);

      const count = db.diario_utente.filter(
        (d: any) => d.email_cliente === DEMO_USER.email && eserciziGiorno.includes(d.id_esercizio)
      ).length;

      return res.end(JSON.stringify({ count }));
    }

    // 10. Reset: POST /app-api/stati/reset
    if (pathname === "/app-api/stati/reset" && method === "POST") {
      const { livello, giorno } = parsedBody;
      const giornoInt = parseInt(String(giorno), 10);

      const eserciziGiorno = db.allenamenti
        .filter((a: any) => {
          if (a.livello !== livello) return false;
          const m = String(a.giorno).match(/[0-9]+/);
          return m && parseInt(m[0], 10) === giornoInt;
        })
        .map((a: any) => a.id_esercizio);

      const initialCount = db.diario_utente.length;
      db.diario_utente = db.diario_utente.filter(
        (d: any) => !(d.email_cliente === DEMO_USER.email && eserciziGiorno.includes(d.id_esercizio))
      );
      const eliminati = initialCount - db.diario_utente.length;

      // Aggiorna stato
      const existing = db.stato_allenamenti.find(
        (s: any) => s.email_cliente === DEMO_USER.email && s.livello === livello && s.giorno === giornoInt
      );
      if (existing) {
        existing.stato = "non_iniziato";
        existing.updated_at = new Date().toISOString();
      } else {
        db.stato_allenamenti.push({
          email_cliente: DEMO_USER.email,
          livello,
          giorno: giornoInt,
          stato: "non_iniziato",
          updated_at: new Date().toISOString(),
        });
      }
      saveData(db);
      return res.end(JSON.stringify({ ok: true, eliminati }));
    }

    // 11. Salva Stato: POST /app-api/stati
    if (pathname === "/app-api/stati" && method === "POST") {
      const { livello, giorno, stato } = parsedBody;
      const existing = db.stato_allenamenti.find(
        (s: any) => s.email_cliente === DEMO_USER.email && s.livello === livello && s.giorno === Number(giorno)
      );
      if (existing) {
        existing.stato = stato;
        existing.updated_at = new Date().toISOString();
      } else {
        db.stato_allenamenti.push({
          email_cliente: DEMO_USER.email,
          livello,
          giorno: Number(giorno),
          stato,
          updated_at: new Date().toISOString(),
        });
      }
      saveData(db);
      return res.end(JSON.stringify({ ok: true }));
    }

    // 12. Diario: GET /app-api/diario
    if (pathname === "/app-api/diario" && method === "GET") {
      const rows = [...db.diario_utente]
        .filter((d: any) => d.email_cliente === DEMO_USER.email)
        .sort((a, b) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime());
      return res.end(JSON.stringify(rows));
    }

    // 13. Diario Esercizio: GET /app-api/diario/esercizio/:idEsercizio
    const diarioExMatch = pathname.match(/^\/app-api\/diario\/esercizio\/([^/]+)$/);
    if (diarioExMatch && method === "GET") {
      const idEsercizio = decodeURIComponent(diarioExMatch[1]);
      const rows = [...db.diario_utente]
        .filter((d: any) => d.email_cliente === DEMO_USER.email && d.id_esercizio === idEsercizio)
        .sort((a, b) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime());
      return res.end(JSON.stringify(rows));
    }

    // 14. Diario Salva: POST /app-api/diario
    if (pathname === "/app-api/diario" && method === "POST") {
      const newEntry = {
        id: Date.now(),
        email_cliente: DEMO_USER.email,
        id_esercizio: parsedBody.id_esercizio,
        nome_esercizio: parsedBody.nome_esercizio,
        carico_kg: parsedBody.sets_json ? null : (parsedBody.carico_kg ?? null),
        feedback: parsedBody.feedback ?? null,
        ripetizioni: parsedBody.sets_json ? null : (parsedBody.ripetizioni ?? null),
        serie: parsedBody.sets_json ? null : (parsedBody.serie ?? null),
        sets_json: parsedBody.sets_json ?? null,
        rpe_json: parsedBody.rpe_json ?? null,
        data_ora: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      db.diario_utente.push(newEntry);
      saveData(db);
      res.statusCode = 201;
      return res.end(JSON.stringify(newEntry));
    }

    // 15. Diario Modifica: PATCH /app-api/diario/:id
    const diarioPatchMatch = pathname.match(/^\/app-api\/diario\/(\d+)$/);
    if (diarioPatchMatch && method === "PATCH") {
      const id = parseInt(diarioPatchMatch[1], 10);
      const entry = db.diario_utente.find((d: any) => d.id === id);
      if (!entry) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: "Not found" }));
      }
      entry.sets_json = parsedBody.sets_json ?? entry.sets_json;
      entry.feedback = parsedBody.feedback ?? entry.feedback;
      if (parsedBody.sets_json) {
        entry.rpe_json = parsedBody.sets_json.map((s: any) => s.rpe ?? null);
      }
      saveData(db);
      return res.end(JSON.stringify(entry));
    }

    // 16. Diario Elimina: DELETE /app-api/diario/:id
    const diarioDeleteMatch = pathname.match(/^\/app-api\/diario\/(\d+)$/);
    if (diarioDeleteMatch && method === "DELETE") {
      const id = parseInt(diarioDeleteMatch[1], 10);
      db.diario_utente = db.diario_utente.filter((d: any) => d.id !== id);
      saveData(db);
      return res.end(JSON.stringify({ ok: true }));
    }

    // 17. Preferenze: GET /app-api/preferenze
    if (pathname === "/app-api/preferenze" && method === "GET") {
      const pref = db.preferenze_utente.find((p: any) => p.email_cliente === DEMO_USER.email);
      return res.end(JSON.stringify({ memoria_livello: pref?.memoria_livello ?? null }));
    }

    // 18. Preferenze Salva: POST /app-api/preferenze/livello
    if (pathname === "/app-api/preferenze/livello" && method === "POST") {
      const existing = db.preferenze_utente.find((p: any) => p.email_cliente === DEMO_USER.email);
      if (existing) {
        existing.memoria_livello = parsedBody.livello ?? null;
        existing.updated_at = new Date().toISOString();
      } else {
        db.preferenze_utente.push({
          email_cliente: DEMO_USER.email,
          memoria_livello: parsedBody.livello ?? null,
          updated_at: new Date().toISOString(),
        });
      }
      saveData(db);
      return res.end(JSON.stringify({ ok: true }));
    }

    // 19. Tonnellaggio: GET /app-api/tonnellaggio
    if (pathname === "/app-api/tonnellaggio" && method === "GET") {
      const rows = db.diario_utente
        .filter((d: any) => d.email_cliente === DEMO_USER.email)
        .map((d: any) => {
          let tonnellaggio_voce = 0;
          if (d.sets_json && Array.isArray(d.sets_json)) {
            tonnellaggio_voce = d.sets_json.reduce((acc: number, s: any) => {
              const kg = Number(s.carico_kg) || 0;
              const reps = Number(s.ripetizioni) || 0;
              return acc + kg * reps;
            }, 0);
          } else if (d.carico_kg != null && d.ripetizioni != null && d.serie != null) {
            tonnellaggio_voce = Number(d.carico_kg) * Number(d.ripetizioni) * Number(d.serie);
          }
          return {
            id: d.id,
            data_ora: d.data_ora,
            nome_esercizio: d.nome_esercizio,
            carico_kg: d.carico_kg,
            ripetizioni: d.ripetizioni,
            serie: d.serie,
            sets_json: d.sets_json,
            tonnellaggio_voce,
          };
        })
        .sort((a: any, b: any) => new Date(a.data_ora).getTime() - new Date(b.data_ora).getTime());
      return res.end(JSON.stringify(rows));
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Endpoint demo non trovato" }));
  });
}
