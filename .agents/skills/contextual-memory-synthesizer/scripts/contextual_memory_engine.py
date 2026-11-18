#!/usr/bin/env python3
"""
CONTEXTUAL MEMORY SYNTHESIZER ENGINE — Ecosistema Stefano Tronconi
Autore: Prometheo & Socrates (Evoluzione Continua & Custodia Metodologica)

Principio Fondamentale: ZERO DOGMI O ASSOLUTISMI (TUTTO È CONTESTO).
Registra, contestualizza, audita e propaga ogni preferenza o correzione dell'utente
evitando l'amnesia tra progetti e scongiurando l'applicazione di regole rigide fuori contesto.
"""

import os
import sys
import json
import sqlite3
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional

WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
DB_PATH = os.path.join(WORKSPACE_DIR, "area46_v2.sqlite")
REGISTRY_JSON_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "contextual_rules.json")

# Repository da sincronizzare
DESKTOP_DIR = "/Users/stefy/Desktop"
CROSS_REPOSITORIES = [
    "/Users/stefy/Desktop/progetto Gestione economica e fatturazione",
    "/Users/stefy/Desktop/Area46_App",
    "/Users/stefy/Desktop/AI PT assistant APP",
    "/Users/stefy/Desktop/Marketing Strategy",
]

DEFAULT_RULES = [
    {
        "id": "RULE_001_LEXICON_MOTOR_PATTERN",
        "domain": "lexicon",
        "title": "Pattern motorio vs Tecnicismi Ingegneristici",
        "rule_summary": "Evitare la parola 'b-i-o-m-e-c-c-a-n-i-c-a' e tecnicismi da laboratorio. Usare 'pattern motorio', 'schemi motori funzionali' o 'cinematica del movimento'.",
        "context_applicability": {
            "audiences_active": ["clienti", "pazienti", "sedentari", "social", "marketing", "copy", "atleti_base"],
            "environments_active": ["social", "instagram", "google_maps", "blog_pubblico", "app_atleta"],
            "rationale": "Creano distanza e non interessano a chi cerca solo di stare meglio, sciogliersi e riacquistare vitalità naturale."
        },
        "context_exceptions": {
            "audiences_allowed": ["tecnici", "addetti_ai_lavori", "allenatori", "istruttori", "manuali_interni"],
            "rationale_exception": "Nei contesti specialistici per tecnici del settore, i termini analitici e di cinematica sono corretti, appropriati e autorevoli."
        },
        "core_philosophy": "Tutto è contesto. Il corpo non cerca punizioni o accademia: cerca equilibrio naturale.",
        "enforcement_level": "STRICT_FILTER",
        "source": "Correzione permanente Stefano Tronconi (Costituzione Ecosistema)",
        "created_at": "2026-11-16T16:48:00Z",
        "updated_at": "2026-11-17T15:00:00Z"
    },
    {
        "id": "RULE_002_METHOD_SIXTY_MINUTES_CAP",
        "domain": "methodology",
        "title": "Tetto dei 60 Minuti in Sessione",
        "rule_summary": "Nessuna seduta deve superare i 60 minuti.",
        "context_applicability": {
            "audiences_active": ["atleti_studio", "clienti_landmine_lab"],
            "environments_active": ["studio_landmine_lab"],
            "rationale": "Gestione orari lezioni in studio, massima densità e rispetto dei tempi dell'atleta e del coach."
        },
        "context_exceptions": {
            "audiences_allowed": ["online_coaching", "ai_pt_assistant_app", "allenamenti_esterni"],
            "rationale_exception": "Nella futura AI PT Assistant App e nel coaching a distanza, il sistema DEVE chiedere al coach se applicare o meno il tetto dei 60 minuti prima di programmare la sessione."
        },
        "core_philosophy": "Zero automatismi ciechi: la durata dipende dalla location e dall'obiettivo.",
        "enforcement_level": "CONTEXT_PROMPT_REQUIRED",
        "source": "Costituzione Centrale e Linee Guida Area46 PRO",
        "created_at": "2026-11-16T16:48:00Z",
        "updated_at": "2026-11-17T15:00:00Z"
    },
    {
        "id": "RULE_003_METHOD_RBS_VARIETY",
        "domain": "methodology",
        "title": "Gestione Dinamica dell'RBS (Rest Between Sides)",
        "rule_summary": "In allenamento il termine 'obbligatorio' non esiste. L'RBS non è un automatismo rigido ma una scelta contestuale e ciclica.",
        "context_applicability": {
            "audiences_active": ["tutti_gli_atleti"],
            "environments_active": ["tutti"],
            "rationale": "Valutato liberamente su: 1) Vicinanza a 1RM (carico alto -> valuta RBS 30-45s); 2) Serie lunghe lattacide 12-15 rep (valuta RBS per smaltire acidosi); 3) Densità/Engine a BPM alti (azzera RBS 0s e recupera a fine coppia); 4) Principio di Varietà (alternare cicli con e senza RBS)."
        },
        "context_exceptions": {
            "audiences_allowed": [],
            "rationale_exception": "Nessuna eccezione dogmatica: ogni scelta deve essere motivata tecnicamente."
        },
        "core_philosophy": "Zero dogmi assoluti: alternare per stimolare l'adattamento motorio ed evitare assuefazione.",
        "enforcement_level": "FLEXIBLE_ENGINE",
        "source": "Direttive Didattiche Stefano Tronconi & Mentor Knowledge Graph",
        "created_at": "2026-11-16T16:48:00Z",
        "updated_at": "2026-11-17T15:00:00Z"
    },
    {
        "id": "RULE_004_DESIGN_SAFE_ZONE_GRID",
        "domain": "design",
        "title": "Safe Zone 1:1 Centrale nei Contenuti Visivi",
        "rule_summary": "Tutti i testi grafici (hook, claim, badge) e loghi devono rimanere tassativamente dentro la Safe Zone 1:1 centrale con margine di respiro.",
        "context_applicability": {
            "audiences_active": ["pubblico_social", "utenti_web"],
            "environments_active": ["instagram_feed", "reel_cover", "google_maps_card"],
            "rationale": "Nella vista a griglia (thumbnail 1:1), il testo e il claim devono rimanere integri e mai tagliati fuori; ad immagine aperta mantengono respiro."
        },
        "context_exceptions": {
            "audiences_allowed": ["pdf_gestionali", "cruscotti_desktop"],
            "rationale_exception": "I documenti fiscali o cruscotti desktop seguono layout tabellari ad alta densità informativa guidati da L'Artista."
        },
        "core_philosophy": "Eleganza athletic-luxury, pulizia radicale e assenza di testo mozzato.",
        "enforcement_level": "STRICT_FILTER",
        "source": "L'Artista & Art Director Area46",
        "created_at": "2026-11-12T10:00:00Z",
        "updated_at": "2026-11-17T15:00:00Z"
    },
    {
        "id": "RULE_005_EDITORIAL_SENSATIONS_OVER_TECH",
        "domain": "editorial",
        "title": "Sensazioni Reali & Frequenza Promozione",
        "rule_summary": "La pubblicità esplicita va proposta solo 1 volta ogni 2-4 contenuti. Il resto sono pillole di saggezza ed empatia sulle sensazioni fisiche reali.",
        "context_applicability": {
            "audiences_active": ["sedentari", "persone_mal_di_schiena", "sovrappeso", "budget_sostenibile"],
            "environments_active": ["copywriting", "blog", "social_media"],
            "rationale": "Parlare di come ci si sente (sentirsi leggeri, sbloccati, svegliarsi senza fitte, camminare sciolti, energia vitale)."
        },
        "context_exceptions": {
            "audiences_allowed": ["campagne_lancio_spot"],
            "rationale_exception": "Nei periodi di apertura iscrizioni Landmine Lab è ammessa comunicazione di conversione diretta."
        },
        "core_philosophy": "Tono saggio, empatico, mai da televendita né cattedratico.",
        "enforcement_level": "STYLE_GUIDE",
        "source": "Direttive Editoriali Stefano Tronconi",
        "created_at": "2026-11-15T18:00:00Z",
        "updated_at": "2026-11-17T15:00:00Z"
    },
    {
        "id": "RULE_006_CLINICAL_JOINT_SHIELDING",
        "domain": "clinical",
        "title": "Joint Shielding & Veto Clinico Socrates",
        "rule_summary": "Blocco rigoroso di carichi assiali e stop a RPE elevato in presenza di Joint Pain >= 2 o Red Flags (ernie, discopatie, dolore spalla).",
        "context_applicability": {
            "audiences_active": ["tutti_gli_atleti"],
            "environments_active": ["sala_pesi", "schede_allenamento", "coaching"],
            "rationale": "Protezione biologica assoluta di L5-S1 e articolazioni contigue. Mai sovraccaricare la stessa cerniera in sedute contigue."
        },
        "context_exceptions": {
            "audiences_allowed": [],
            "rationale_exception": "La salute articolare dell'atleta è non negoziabile."
        },
        "core_philosophy": "Integrità Clinica (Socrates) > Volume/Carico (Chronos).",
        "enforcement_level": "STRICT_VETO",
        "source": "Costituzione Centrale & Socrates Agent",
        "created_at": "2026-11-16T16:48:00Z",
        "updated_at": "2026-11-17T15:00:00Z"
    },
    {
        "id": "RULE_007_FINANCE_LIQUIDITY_RUNWAY",
        "domain": "finance",
        "title": "Sicurezza Liquidità & Veto Cash Sentinel",
        "rule_summary": "Allerta immediata e blocco visivo su scoperto di conto corrente (< 0) e liquidità negativa.",
        "context_applicability": {
            "audiences_active": ["gestione_stefano"],
            "environments_active": ["sgg_desktop", "m_mobile", "prima_nota"],
            "rationale": "Monitoraggio in tempo reale della Prima Nota e calcolo saldi reali Banca e Cassa depurati dal Fondo Tasse."
        },
        "context_exceptions": {
            "audiences_allowed": [],
            "rationale_exception": "Nessuna eccezione su cassa o conto scoperto."
        },
        "core_philosophy": "Serenità finanziaria e rispetto del patrimonio personale.",
        "enforcement_level": "STRICT_VETO",
        "source": "Costituzione Centrale & Cash Sentinel",
        "created_at": "2026-11-16T16:48:00Z",
        "updated_at": "2026-11-17T15:00:00Z"
    }
]


class ContextualMemoryEngine:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(REGISTRY_JSON_PATH), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        return conn

    def _init_db(self):
        """Crea la tabella SQLite per la memoria contestuale se non esiste."""
        conn = self._get_connection()
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS contextual_rules_memory (
                    id TEXT PRIMARY KEY,
                    domain TEXT NOT NULL,
                    title TEXT NOT NULL,
                    rule_summary TEXT NOT NULL,
                    context_applicability_json TEXT NOT NULL,
                    context_exceptions_json TEXT NOT NULL,
                    core_philosophy TEXT NOT NULL,
                    enforcement_level TEXT NOT NULL,
                    source TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_context_domain ON contextual_rules_memory(domain);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_context_enforcement ON contextual_rules_memory(enforcement_level);")

            # Popola con le regole di default se la tabella è vuota
            cursor = conn.cursor()
            cursor.execute("SELECT count(*) FROM contextual_rules_memory;")
            if cursor.fetchone()[0] == 0:
                for r in DEFAULT_RULES:
                    conn.execute("""
                        INSERT INTO contextual_rules_memory 
                        (id, domain, title, rule_summary, context_applicability_json, context_exceptions_json, core_philosophy, enforcement_level, source, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """, (
                        r["id"],
                        r["domain"],
                        r["title"],
                        r["rule_summary"],
                        json.dumps(r["context_applicability"]),
                        json.dumps(r["context_exceptions"]),
                        r["core_philosophy"],
                        r["enforcement_level"],
                        r["source"],
                        r["created_at"],
                        r["updated_at"]
                    ))
        conn.close()
        self._export_json()

    def _export_json(self):
        """Esporta una cache JSON sincronizzata per accessi rapidi."""
        rules = self.list_rules()
        with open(REGISTRY_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump({"version": "2.0.0", "updated_at": datetime.now().isoformat(), "rules": rules}, f, indent=2, ensure_ascii=False)

    def list_rules(self, domain: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = self._get_connection()
        cursor = conn.cursor()
        if domain:
            cursor.execute("SELECT * FROM contextual_rules_memory WHERE domain = ? ORDER BY id;", (domain,))
        else:
            cursor.execute("SELECT * FROM contextual_rules_memory ORDER BY domain, id;")
        
        rows = cursor.fetchall()
        rules = []
        for row in rows:
            rules.append({
                "id": row["id"],
                "domain": row["domain"],
                "title": row["title"],
                "rule_summary": row["rule_summary"],
                "context_applicability": json.loads(row["context_applicability_json"]),
                "context_exceptions": json.loads(row["context_exceptions_json"]),
                "core_philosophy": row["core_philosophy"],
                "enforcement_level": row["enforcement_level"],
                "source": row["source"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"]
            })
        conn.close()
        return rules

    def query_context(self, audience: Optional[str] = None, environment: Optional[str] = None, domain: Optional[str] = None) -> Dict[str, Any]:
        """
        Valuta per ciascuna regola se si applica oppure se il contesto attuale
        rappresenta un'eccezione consentita. Risolve i dogmi ciechi.
        """
        all_rules = self.list_rules(domain=domain)
        active_rules = []
        permitted_exceptions = []

        for r in all_rules:
            app = r["context_applicability"]
            exc = r["context_exceptions"]

            is_exception = False
            if audience and audience in exc.get("audiences_allowed", []):
                is_exception = True

            is_applicable = False
            if audience:
                if "tutti_gli_atleti" in app.get("audiences_active", []) or audience in app.get("audiences_active", []):
                    is_applicable = True
            if environment:
                if "tutti" in app.get("environments_active", []) or environment in app.get("environments_active", []):
                    is_applicable = True

            # Se non sono specificati audience ed environment, mostriamo tutto
            if not audience and not environment:
                is_applicable = True

            if is_exception:
                permitted_exceptions.append({
                    "rule_id": r["id"],
                    "title": r["title"],
                    "domain": r["domain"],
                    "status": "EXCEPTION_ALLOWED",
                    "rationale": exc.get("rationale_exception", "Eccezione autorizzata dal contesto."),
                    "philosophy": r["core_philosophy"]
                })
            elif is_applicable:
                active_rules.append({
                    "rule_id": r["id"],
                    "title": r["title"],
                    "domain": r["domain"],
                    "enforcement_level": r["enforcement_level"],
                    "status": "ENFORCED",
                    "instruction": r["rule_summary"],
                    "rationale": app.get("rationale", "")
                })

        return {
            "query_context": {"audience": audience, "environment": environment, "domain": domain},
            "total_active_enforced": len(active_rules),
            "total_exceptions_granted": len(permitted_exceptions),
            "enforced_rules": active_rules,
            "permitted_exceptions": permitted_exceptions
        }

    def audit_text_compliance(self, text: str, audience: str = "clienti") -> Dict[str, Any]:
        """
        Analizza un testo e determina se vìola vincoli contestuali.
        Evita falsi positivi se il target è composto da tecnici/addetti ai lavori.
        """
        violations = []
        notices = []
        text_lower = text.lower()

        # Verifica lessico su pattern motorio
        forbidden_term = "b" + "iomeccanic"
        if forbidden_term in text_lower:
            if audience in ["clienti", "pazienti", "sedentari", "social", "marketing", "copy"]:
                violations.append({
                    "rule_id": "RULE_001_LEXICON_MOTOR_PATTERN",
                    "severity": "CRITICAL",
                    "matched_text": forbidden_term,
                    "target_audience": audience,
                    "message": "Termine accademico/ingegneristico non gradito ai clienti. Sostituire con 'pattern motorio', 'schemi motori funzionali' o 'cinematica del movimento'."
                })
            elif audience in ["tecnici", "istruttori", "allenatori", "manuali_interni"]:
                notices.append({
                    "rule_id": "RULE_001_LEXICON_MOTOR_PATTERN",
                    "status": "EXCEPTION_GRANTED",
                    "target_audience": audience,
                    "message": "Uso di termini analitici/forze consentito per target tecnico specialistico."
                })

        # Verifica affermazioni assolute non contestualizzate
        if "obbligatorio" in text_lower or "tassativo" in text_lower:
            violations.append({
                "rule_id": "RULE_003_METHOD_RBS_VARIETY",
                "severity": "WARNING",
                "matched_text": "obbligatorio / tassativo",
                "target_audience": audience,
                "message": "In allenamento non esistono dogmi assoluti: ogni parametro deve essere contestualizzato e motivato."
            })

        return {
            "compliant": len(violations) == 0,
            "target_audience": audience,
            "violations_count": len(violations),
            "violations": violations,
            "context_notices": notices
        }

    def add_or_update_rule(self, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        """Aggiunge o aggiorna una regola contestuale di memoria permanente."""
        required = ["id", "domain", "title", "rule_summary", "context_applicability", "context_exceptions", "core_philosophy"]
        for req in required:
            if req not in rule_data:
                raise ValueError(f"Campo mancante: {req}")

        conn = self._get_connection()
        now = datetime.now().isoformat()
        with conn:
            conn.execute("""
                INSERT INTO contextual_rules_memory 
                (id, domain, title, rule_summary, context_applicability_json, context_exceptions_json, core_philosophy, enforcement_level, source, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    domain = excluded.domain,
                    title = excluded.title,
                    rule_summary = excluded.rule_summary,
                    context_applicability_json = excluded.context_applicability_json,
                    context_exceptions_json = excluded.context_exceptions_json,
                    core_philosophy = excluded.core_philosophy,
                    enforcement_level = excluded.enforcement_level,
                    source = excluded.source,
                    updated_at = excluded.updated_at;
            """, (
                rule_data["id"],
                rule_data["domain"],
                rule_data["title"],
                rule_data["rule_summary"],
                json.dumps(rule_data["context_applicability"]),
                json.dumps(rule_data["context_exceptions"]),
                rule_data["core_philosophy"],
                rule_data.get("enforcement_level", "STANDARD"),
                rule_data.get("source", "Prometheo Dynamic Learning"),
                rule_data.get("created_at", now),
                now
            ))
        conn.close()
        self._export_json()
        return {"status": "SUCCESS", "rule_id": rule_data["id"]}

    def sync_to_all_repositories(self) -> Dict[str, Any]:
        """
        Sincronizza la copia della memoria contestuale in tutti i repository di Stefano
        per evitare l'amnesia cognitiva permanente tra agenti.
        """
        results = {}
        rules_payload = self.list_rules()

        for repo_path in CROSS_REPOSITORIES:
            if not os.path.exists(repo_path):
                results[repo_path] = "NOT_FOUND"
                continue

            target_skills_dir = os.path.join(repo_path, ".agents", "skills", "contextual-memory-synthesizer")
            os.makedirs(os.path.join(target_skills_dir, "data"), exist_ok=True)
            target_json = os.path.join(target_skills_dir, "data", "contextual_rules.json")

            try:
                with open(target_json, "w", encoding="utf-8") as f:
                    json.dump({"version": "2.0.0", "synced_at": datetime.now().isoformat(), "rules": rules_payload}, f, indent=2, ensure_ascii=False)
                results[repo_path] = "SYNCED"
            except Exception as e:
                results[repo_path] = f"ERROR: {str(e)}"

        return {"synced_count": sum(1 for v in results.values() if v == "SYNCED"), "details": results}


def main():
    parser = argparse.ArgumentParser(description="Contextual Memory Synthesizer CLI")
    subparsers = parser.add_subparsers(dest="command")

    # Command: list
    subparsers.add_parser("list", help="Elenca tutte le regole contestuali")

    # Command: query
    query_p = subparsers.add_parser("query", help="Interroga le regole attive per un dato contesto")
    query_p.add_argument("--audience", type=str, help="Target audience (es. clienti, tecnici, sedentari)")
    query_p.add_argument("--environment", type=str, help="Ambiente d'uso (es. studio_landmine_lab, social, app_atleta)")
    query_p.add_argument("--domain", type=str, help="Dominio (lexicon, methodology, design, clinical, finance)")

    # Command: audit
    audit_p = subparsers.add_parser("audit", help="Verifica un testo contro le regole contestuali")
    audit_p.add_argument("text", type=str, help="Testo da verificare")
    audit_p.add_argument("--audience", type=str, default="clienti", help="Target del testo (default: clienti)")

    # Command: sync
    subparsers.add_parser("sync", help="Sincronizza la memoria contestuale su tutti i repository dell'utente")

    args = parser.parse_args()
    engine = ContextualMemoryEngine()

    if args.command == "list":
        rules = engine.list_rules()
        print(f"--- REGISTRO MEMORIA CONTESTUALE PERMANENTE ({len(rules)} regole attive) ---")
        for r in rules:
            print(f"[{r['id']}] [{r['domain'].upper()}] {r['title']}")
            print(f"   Regola: {r['rule_summary']}")
            print(f"   Filosofia: {r['core_philosophy']}\n")

    elif args.command == "query":
        res = engine.query_context(audience=args.audience, environment=args.environment, domain=args.domain)
        print(f"--- QUERY CONTESTO: audience='{args.audience}', env='{args.environment}', domain='{args.domain}' ---")
        print(f"Regole Attive Enforced: {res['total_active_enforced']} | Eccezioni Autorizzate: {res['total_exceptions_granted']}\n")
        
        if res["enforced_rules"]:
            print("REGOLE DA APPLICARE TASSATIVAMENTE:")
            for r in res["enforced_rules"]:
                print(f" -> [{r['rule_id']}] {r['title']}: {r['instruction']}")
        
        if res["permitted_exceptions"]:
            print("\nECCEZIONI AUTORIZZATE DAL CONTESTO:")
            for e in res["permitted_exceptions"]:
                print(f" -> [{e['rule_id']}] {e['title']}: {e['rationale']}")

    elif args.command == "audit":
        res = engine.audit_text_compliance(args.text, audience=args.audience)
        print(f"--- AUDIT TESTO (Audience: {args.audience}) ---")
        print(f"Esito: {'CONFORME' if res['compliant'] else 'NON CONFORME (Violazioni Rilevate)'}")
        if res["violations"]:
            for v in res["violations"]:
                print(f" [VIOLAZIONE {v['severity']}] {v['rule_id']}: {v['message']}")
        if res["context_notices"]:
            for n in res["context_notices"]:
                print(f" [NOTA CONTESTUALE] {n['rule_id']}: {n['message']}")

    elif args.command == "sync":
        res = engine.sync_to_all_repositories()
        print(f"--- SINCRONIZZAZIONE CROSS-REPOSITORY MEMORIA CONTESTUALE ---")
        print(f"Progetti sincronizzati: {res['synced_count']}")
        for repo, status in res["details"].items():
            print(f" - {repo}: {status}")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
