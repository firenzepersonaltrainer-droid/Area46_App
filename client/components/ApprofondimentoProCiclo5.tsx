import React, { useState, useRef } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Clock,
  Target,
  Brain,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./Dialog";

export function ApprofondimentoProCiclo5() {
  const [aperto, setAperto] = useState(false);
  const [modalAperta, setModalAperta] = useState(false);
  const barraRef = useRef<HTMLDivElement>(null);

  function chiudiTesto() {
    setAperto(false);
    setTimeout(() => {
      barraRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  }

  return (
    <div className="mt-3">
      {/* BARRA MENU PRINCIPALE - STESSA DIMENSIONE DEI MENU CICLI, COLORI BRAND E SOLO DICITURA "APPROFONDIMENTI" */}
      <div
        ref={barraRef}
        onClick={() => setAperto((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setAperto((prev) => !prev);
          }
        }}
        className="rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between shadow-xs cursor-pointer select-none transition-all hover:brightness-105 active:scale-[0.995]"
        style={{
          background: "#e3ff00",
          border: "1px solid #1c00ff",
        }}
        title="Clicca per aprire o comprimere gli approfondimenti"
      >
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`size-4 transition-transform duration-200 text-[#1c00ff] ${
              !aperto ? "-rotate-90" : "rotate-0"
            }`}
          />
          <span className="text-sm font-black uppercase tracking-wider text-[#1c00ff]">
            Approfondimenti
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-[#1c00ff]/90 uppercase hidden sm:inline">
            {aperto ? "Comprimi" : "Mostra"}
          </span>
        </div>
      </div>

      {/* CONTENUTO ACCORDION INLINE SU SFONDO CHIARO TIPO ARTICOLO BLOG */}
      {aperto && (
        <div
          className="mt-1 mb-4 rounded-2xl p-5 sm:p-8 bg-white border border-zinc-200 shadow-sm transition-all animate-in fade-in duration-200"
        >
          <div className="flex justify-end mb-4 border-b border-zinc-100 pb-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setModalAperta(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#1c00ff] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
            >
              <Maximize2 className="size-3.5" />
              Modalità Lettura a Schermo Intero
            </button>
          </div>

          <ArticoloMaturitaAtletica />

          {/* COMANDO AL TERMINE PER CHIUDERE IL TESTO E TORNARE ALLA SOLA BARRA MENU */}
          <div className="mt-8 pt-5 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={chiudiTesto}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-zinc-950 bg-[#e3ff00] hover:bg-[#d6f000] border border-[#1c00ff] shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <ChevronUp className="size-4 text-[#1c00ff] stroke-[2.5]" />
              Chiudi Approfondimenti
            </button>
            <span className="text-xs text-zinc-500 font-medium">
              Torna alla sola barra menù
            </span>
          </div>
        </div>
      )}

      {/* MODALE DI LETTURA IMMERSIVA A SCHERMO INTERO SU SFONDO CHIARO */}
      <Dialog open={modalAperta} onOpenChange={setModalAperta}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-white text-zinc-900 rounded-3xl p-6 sm:p-10 border border-zinc-200 shadow-2xl [scrollbar-width:thin]">
          <DialogHeader className="mb-4 text-left border-b border-zinc-200 pb-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1c00ff]">
              <BookOpen className="size-4" />
              Area46 Training Lab • Approfondimenti Livello PRO
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-zinc-950 mt-1">
              Verso la Maturità Atletica: Guida, Metodo e Consapevolezza
            </DialogTitle>
          </DialogHeader>

          <ArticoloMaturitaAtletica />

          <div className="mt-8 pt-5 border-t border-zinc-200 flex justify-end">
            <button
              type="button"
              onClick={() => setModalAperta(false)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-zinc-950 bg-[#e3ff00] hover:bg-[#d6f000] border border-[#1c00ff] shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArticoloMaturitaAtletica() {
  return (
    <article className="max-w-none text-zinc-700 leading-relaxed space-y-6">
      {/* HEADER ARTICOLO ORDINATO TIPO BLOG */}
      <div className="rounded-2xl p-5 sm:p-6 bg-zinc-50 border border-zinc-200">
        <div className="flex items-center gap-2 text-[#1c00ff] text-xs font-black uppercase tracking-wider mb-2">
          <BookOpen className="size-4" />
          Comunicazione Tecnica e Metodologica del Coach
        </div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-zinc-950 tracking-tight leading-snug">
          Verso la Maturità Atletica: Guida, Metodo e Consapevolezza dopo il 5° Ciclo
        </h1>
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500 font-semibold flex-wrap">
          <span className="text-zinc-900 font-bold">Coach Stefano Tronconi</span>
          <span>•</span>
          <span>Target: Atleti Livello PRO</span>
          <span>•</span>
          <span>Transizione Ciclo 5 → Ciclo 6</span>
        </div>
      </div>

      {/* INCIPIT */}
      <div className="space-y-3">
        <p className="text-[15px] sm:text-base text-zinc-700 leading-relaxed">
          Ciao a tutti, <br />
          siamo arrivati alla conclusione del 5° ciclo di lavoro del livello PRO... avete macinato fin qui moltissime ore di lavoro, avete costruito basi solide, assimilato i movimenti e iniziato a capire come risponde il vostro corpo.
        </p>
        <p className="text-[15px] sm:text-base text-zinc-700 leading-relaxed">
          Adesso entriamo in una fase diversa del percorso: <strong className="text-zinc-950 font-bold">la fase della maturità atletica</strong>. <br />
          La differenza tra chi ottiene risultati straordinari e chi finisce semplicemente per &ldquo;stancarsi&rdquo; non sta nel cambiare continuamente esercizi, ma nella <strong className="text-zinc-950 font-bold">qualità, nella precisione e nell&apos;intenzione</strong> con cui si affronta ogni singola ripetizione.
        </p>
        <p className="text-[15px] sm:text-base text-zinc-900 font-semibold leading-relaxed">
          Ci sono tre nozioni chiave che voglio facciate vostri per affrontare i prossimi cicli con un livello superiore di consapevolezza:
        </p>
      </div>

      <hr className="border-zinc-200" />

      {/* SEZIONE 1: RPE */}
      <section className="space-y-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#1c00ff]/10 text-[#1c00ff] font-black text-sm">
            1
          </span>
          <h2 className="text-lg sm:text-xl font-black text-zinc-950">
            L’RPE: Lo strumento per governare lo stimolo (e non subirlo)
          </h2>
        </div>

        <p className="text-[15px] sm:text-base text-zinc-700 leading-relaxed">
          Nelle schede trovate sempre più spesso l&apos;indicazione <strong className="text-zinc-900 font-bold">RPE</strong> (<em>Rating of Perceived Exertion</em>). Non è una sigla per complicarvi la vita, ma il nostro principale strumento per dosare lo stimolo.
        </p>

        {/* BOX TRAUMA CONTROLLATO */}
        <div className="rounded-xl p-4 sm:p-5 bg-zinc-50 border border-zinc-200 space-y-3">
          <div className="flex items-center gap-2 text-zinc-900 font-bold text-sm sm:text-base">
            <Brain className="size-4.5 text-[#1c00ff]" />
            <h3 className="font-bold text-zinc-900 text-sm sm:text-base">
              L’allenamento è un &ldquo;trauma programmato&rdquo;: la consapevolezza dello sforzo
            </h3>
          </div>
          <p className="text-[15px] sm:text-base text-zinc-700 leading-relaxed">
            Il nostro corpo è un sistema biologico conservativo: non ha alcun interesse a costruire nuovo tessuto muscolare o aumentare la forza a meno che non sia strettamente costretto a farlo. <br />
            L&apos;allenamento, biologicamente parlando, <strong className="text-zinc-950">deve rappresentare uno stimolo di rottura, un piccolo trauma controllato per i nostri sistemi</strong> (muscolare, tendineo e nervoso). Solo se riceve questo segnale di allarme il corpo reagisce adattandosi e migliorando.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-950">
              <strong className="block text-red-700 font-bold text-xs sm:text-sm mb-1">❌ Carichi troppo leggeri</strong>
              <p className="text-xs sm:text-sm text-red-900 leading-normal">
                Se una serie è troppo facile (RPE 5-6 quando è richiesto 8), per il corpo è ordinaria amministrazione. Zero allarme, zero adattamento. Si perde tempo.
              </p>
            </div>
            <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-red-950">
              <strong className="block text-red-700 font-bold text-xs sm:text-sm mb-1">❌ Strafare a ogni costo</strong>
              <p className="text-xs sm:text-sm text-red-900 leading-normal">
                Oltrepassare costantemente il limite porta al cedimento scomposto, distrugge la tecnica e sovraccarica le articolazioni senza stimolo aggiuntivo utile.
              </p>
            </div>
            <div className="rounded-lg p-3 bg-emerald-50 border border-emerald-200 text-emerald-950">
              <strong className="block text-emerald-700 font-bold text-xs sm:text-sm mb-1">✅ La Consapevolezza</strong>
              <p className="text-xs sm:text-sm text-emerald-900 leading-normal">
                Imparare a riconoscere e cercare attivamente quella specifica soglia di fatica in cui il corpo lavora davvero vicino al limite, mantenendo sempre il controllo.
              </p>
            </div>
          </div>
        </div>

        {/* SCALA RPE */}
        <div className="rounded-xl p-4 sm:p-5 bg-zinc-50 border border-zinc-200 space-y-3">
          <h3 className="font-bold text-zinc-900 text-sm sm:text-base flex items-center gap-2">
            <Layers className="size-4 text-[#1c00ff]" />
            La scala RPE in sintesi (Reps in Reserve - RIR)
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/80 border border-red-200 text-[15px] sm:text-base">
              <span className="font-black text-red-700">RPE 10</span>
              <span className="text-zinc-800 text-right">Cedimento tecnico. Zero ripetizioni di riserva possibili.</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-orange-50/80 border border-orange-200 text-[15px] sm:text-base">
              <span className="font-black text-orange-700">RPE 9</span>
              <span className="text-zinc-800 text-right">Potevate completare ancora <strong>1</strong> ripetizione pulita.</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[15px] sm:text-base">
              <span className="font-black text-amber-700">RPE 8</span>
              <span className="text-zinc-800 text-right">Potevate completare ancora <strong>2</strong> ripetizioni pulite.</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-[15px] sm:text-base">
              <span className="font-black text-emerald-700">RPE 7</span>
              <span className="text-zinc-800 text-right">Potevate completare ancora <strong>3</strong> ripetizioni (movimento fluido e brillante).</span>
            </div>
          </div>
        </div>

        {/* LA REGOLA D'ORO */}
        <div className="rounded-xl p-4 sm:p-5 bg-amber-50/80 border-l-4 border-amber-400 space-y-2.5">
          <h3 className="font-black text-zinc-950 text-sm sm:text-base flex items-center gap-2">
            <Target className="size-4.5 text-[#1c00ff]" />
            La regola d&apos;oro: l&apos;RPE è PIÙ IMPORTANTE del numero di ripetizioni prescritte
          </h3>
          <p className="text-[15px] sm:text-base text-zinc-700 leading-relaxed">
            La scheda vi indica un numero di ripetizioni (ad esempio 6 rep), ma l&apos;obiettivo primario è <strong>il livello di stimolo (RPE)</strong>:
          </p>
          <ul className="list-disc pl-5 text-[15px] sm:text-base space-y-1.5 text-zinc-700 leading-relaxed">
            <li>
              Se avete in scheda un <strong>3x6 @ RPE 8</strong>, ma alla <strong>5ª ripetizione</strong> sentite che la velocità è crollata e ne avete soltanto altre 2 di riserva: <strong>ci si ferma a 5 ripetizioni</strong>. Forzare la sesta significherebbe trasformare la serie in un RPE 9 o 10, sforando la fatica programmata.
            </li>
            <li>
              Al contrario: se arrivate alla <strong>6ª ripetizione</strong> e vi accorgete di essere ancora troppo freschi (avreste ancora 4 o 5 ripetizioni in riserva): <strong>continuate per 1 o 2 ripetizioni in più</strong>, andando a cogliere l&apos;RPE 8 target.
            </li>
          </ul>
          <p className="text-[15px] sm:text-base text-zinc-900 font-semibold pt-1">
            💡 Muoversi con una flessibilità di <strong>± 1-2 ripetizioni</strong> rispetto a quanto scritto è il modo corretto di allenarsi per centrare lo stimolo esatto. Se la differenza fosse maggiore di 2 ripetizioni, significa che il carico scelto era totalmente fuori target e andrà corretto nella serie successiva.
          </p>
        </div>

        {/* FATICA SISTEMICA VS FATICA MUSCOLARE SUI COMPLEMENTARI */}
        <div className="space-y-3">
          <h3 className="font-bold text-zinc-950 text-sm sm:text-base">
            Dove serve l&apos;RPE, dove si può spingere e dove NON si usa: Fatica Sistemica vs Fatica Muscolare
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl p-4 bg-zinc-50 border border-zinc-200 space-y-2">
              <strong className="block text-zinc-950 font-bold text-[15px] sm:text-base">
                1. Fatica Sistemica (Esercizi Fondamentali)
              </strong>
              <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
                Nei grandi esercizi fondamentali multiarticolari, lo sforzo coinvolge l&apos;intera catena cinetica e il sistema nervoso centrale. Qui il rispetto dell&apos;RPE è <strong>tassativo</strong>: esagerare genera una fatica neurale profonda che richiede giorni per essere smaltita e aumenta il rischio di compensi posturali scorretti.
              </p>
            </div>
            <div className="rounded-xl p-4 bg-zinc-50 border border-zinc-200 space-y-2">
              <strong className="block text-zinc-950 font-bold text-[15px] sm:text-base">
                2. Fatica Muscolare (Esercizi Complementari)
              </strong>
              <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
                Negli <strong>esercizi complementari</strong>, la fatica è quasi esclusivamente locale a carico del singolo distretto muscolare. L&apos;impatto sul sistema nervoso centrale è ridotto, ed è per questo che negli esercizi complementari ci si può spingere con maggiore serenità verso RPE più alti per ricercare il pieno esaurimento muscolare e lo stimolo ipertrofico locale.
              </p>
            </div>
            <div className="rounded-xl p-4 bg-zinc-50 border border-zinc-200 space-y-2">
              <strong className="block text-zinc-950 font-bold text-[15px] sm:text-base">
                3. Lavori Dinamici e Balistici
              </strong>
              <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
                Nelle componenti balistiche, di agilità, destrezza o nei lavori metabolici dinamici, l&apos;RPE a cedimento non si applica. L&apos;obiettivo è sempre la <strong>freschezza neurale, la reattività elastica e la velocità esecutiva</strong>. Portare questi movimenti vicino al limite vanificherebbe il loro scopo coordinativo.
              </p>
            </div>
          </div>
        </div>

        {/* RAMPING / SERIE DI AVVICINAMENTO */}
        <div className="rounded-xl p-4 sm:p-5 bg-zinc-50 border border-zinc-200 space-y-2.5">
          <h3 className="font-bold text-zinc-950 text-sm sm:text-base flex items-center gap-2">
            <Clock className="size-4 text-[#1c00ff]" />
            Serie di Avvicinamento (Ramping): A cosa servono e come gestirle
          </h3>
          <p className="text-[15px] sm:text-base text-zinc-700 leading-relaxed">
            Le serie di avvicinamento non sono serie allenanti anticipate e non servono a fare volume:
          </p>
          <ul className="list-disc pl-5 text-[15px] sm:text-base space-y-1.5 text-zinc-700 leading-relaxed">
            <li><strong>Meccanicamente:</strong> aumentano la temperatura interna, distribuiscono il liquido sinoviale nelle articolazioni, elasticizzano i tendini e oliano il binario motorio.</li>
            <li><strong>A livello nervoso:</strong> svegliano il sistema nervoso centrale, aumentando il reclutamento delle fibre senza traumi improvvisi.</li>
            <li><strong>NON devono stancare:</strong> si eseguono sempre a bassissime ripetizioni (da 4-6 rep a scendere fino a 1-2 man mano che ci si avvicina al carico di lavoro) salendo gradualmente di peso. Mai fiatone o lattato.</li>
            <li><strong>I recuperi:</strong> 30-45&quot; con carichi bassi; 60-90&quot; avvicinandosi alla prima serie allenante per partire al 100%.</li>
            <li><strong>La differenza di scala:</strong> chi punta a 30 kg sarà pronto con 1 o 2 serie rapide; chi punta a 120 kg necessita di 4 o 5 serie progressive per preparare capsule e tendini in totale sicurezza.</li>
          </ul>
        </div>

        {/* RPE IN OGNI SERIE VS ALL'ULTIMA SERIE */}
        <div className="rounded-xl p-4 sm:p-5 bg-zinc-50 border border-zinc-200 space-y-2.5">
          <h3 className="font-bold text-zinc-950 text-sm sm:text-base">
            RPE in OGNI serie vs RPE all&apos;ULTIMA serie
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-white border border-zinc-200">
              <strong className="block text-zinc-900 font-bold mb-1 text-[15px] sm:text-base">RPE all&apos;ULTIMA serie:</strong>
              <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
                Individuare un carico fisso e, mantenendolo per tutte le serie, arrivare a toccare l&apos;RPE target solo all&apos;ultima ripetizione dell&apos;ultima serie. Le prime serie fanno da accumulo.
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-blue-50/60 border border-blue-200">
              <strong className="block text-[#1c00ff] font-bold mb-1 text-[15px] sm:text-base">RPE in OGNI serie (focus attuale):</strong>
              <p className="text-zinc-800 text-[15px] sm:text-base leading-relaxed">
                Già dalla prima serie allenante dovete essere al livello di fatica prescritto (es. RPE 8). Poiché tra le serie si accumula fatica, siate pronti, se necessario, a togliere una piccola percentuale di peso per conservare il medesimo grado di stimolo e di velocità.
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-zinc-200" />

      {/* SEZIONE 2: DECIFRARE LA SCHEDA */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#1c00ff]/10 text-[#1c00ff] font-black text-sm">
            2
          </span>
          <h2 className="text-lg sm:text-xl font-black text-zinc-950">
            Decifrare la Scheda: Parametri e Recuperi senza dubbi
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-4 sm:p-5 bg-zinc-50 border border-zinc-200 space-y-2">
            <h3 className="font-bold text-zinc-950 text-sm sm:text-base">&ldquo;3 × 8&rdquo; oppure &ldquo;3 × 8+8&rdquo;</h3>
            <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
              <strong>3 × 8:</strong> 3 serie da 8 ripetizioni in un movimento in cui il lavoro viene svolto contemporaneamente su entrambi i lati del corpo. 8 ripetizioni fatte, serie conclusa.
            </p>
            <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
              <strong>3 × 8+8:</strong> È l&apos;indicazione inequivocabile di un esercizio <strong>unilaterale</strong>. Significa <strong>8 ripetizioni con il primo lato + 8 ripetizioni con il secondo lato</strong>. Entrambi i lati devono essere completati per chiudere la serie.
            </p>
          </div>

          <div className="rounded-xl p-4 sm:p-5 bg-zinc-50 border border-zinc-200 space-y-2">
            <h3 className="font-bold text-zinc-950 text-sm sm:text-base">I Recuperi: &ldquo;Rec&rdquo; vs &ldquo;RBS&rdquo;</h3>
            <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
              <strong>Rec (Recupero tra le serie):</strong> Pausa al termine dell&apos;intera serie prima di ripartire con il giro successivo. Serve a rigenerare l&apos;ATP/CP e la concentrazione. Non va accorciato per fare prima.
            </p>
            <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
              <strong>RBS (Rest Between Sides - Recupero tra i lati):</strong> Negli unilaterali, passare a zero secondi tra un arto e l&apos;altro penalizza il secondo lato. Se trovate scritto <strong>RBS (es. 30&quot;-45&quot;)</strong>: fate il primo lato (meglio partire dal debole), prendete i 30-45&quot; di RBS, fate il secondo lato e solo dopo fate partire il <strong>Rec</strong> standard.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-zinc-200" />

      {/* SEZIONE 3: MINDSET */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#1c00ff]/10 text-[#1c00ff] font-black text-sm">
            3
          </span>
          <h2 className="text-lg sm:text-xl font-black text-zinc-950">
            Il Mindset e l&apos;Intenzione Esecutiva
          </h2>
        </div>

        <blockquote className="my-6 rounded-xl p-5 bg-blue-50/70 border-l-4 border-[#1c00ff] text-zinc-900 italic text-[15px] sm:text-base font-semibold leading-relaxed shadow-2xs">
          &ldquo;Non pensare a quale effetto l&apos;allenamento ha sul tuo corpo; preoccupati di quale effetto il tuo corpo deve avere sull&apos;allenamento.&rdquo;
        </blockquote>

        <p className="text-[15px] sm:text-base text-zinc-700 leading-relaxed">
          Questa frase racchiude il confine tra chi ottiene trasformazioni reali e chi si limita a &ldquo;fare presenza&rdquo;.
        </p>

        <div className="rounded-xl p-4 sm:p-5 bg-zinc-50 border border-zinc-200 space-y-2.5">
          <p className="font-bold text-zinc-950 text-[15px] sm:text-base">
            Il cervello umano è programmato per economizzare energia. Di fronte al carico e alla fatica che cresce, cerca istintivamente scorciatoie:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-700 text-[15px] sm:text-base leading-relaxed">
            <li>Tagliare gli ultimi centimetri di accosciata per non finire nel punto più profondo;</li>
            <li><strong className="text-zinc-950">Cedere passivamente alla forza di gravità nella fase eccentrica</strong>, lasciando cadere il carico verso il basso senza controllarlo per evitare l&apos;allungamento sotto tensione;</li>
            <li>Rimbalzare a inizio spinta anziché invertire il carico con forza attiva;</li>
            <li>Ridurre l&apos;estensione articolare per sfuggire al tratto di movimento in cui il muscolo brucia di più.</li>
          </ul>
          <p className="pt-2 text-zinc-900 font-semibold text-[15px] sm:text-base leading-relaxed border-t border-zinc-200">
            In tutti questi casi state fuggendo proprio dal settore in cui si genera il vero stimolo muscolare, solo per non fare fatica. <br />
            <strong>Spostare un peso dal punto A al punto B senza controllo è pura inerzia; dominare la traiettoria e imporre la tensione muscolare contro la gravità è allenamento vero.</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
            <strong className="block text-zinc-950 font-bold text-[15px] sm:text-base">1. Limite Tecnico</strong>
            <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
              Pretendete che l&apos;ultima ripetizione abbia la stessa precisione e pulizia della prima, a prescindere dal peso sollevato.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
            <strong className="block text-zinc-950 font-bold text-[15px] sm:text-base">2. Limite Motorio</strong>
            <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
              Sentite il corpo che governa il carico in ogni millimetro del movimento, soprattutto nella fase eccentrica di discesa, rifiutando ogni cedimento passivo.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
            <strong className="block text-zinc-950 font-bold text-[15px] sm:text-base">3. Limite di Intensità</strong>
            <p className="text-zinc-700 text-[15px] sm:text-base leading-relaxed">
              Imparate a non fermarvi non appena compare il disagio. È nel saper governare quel disagio che si costruisce la crescita fisica e mentale.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-zinc-200" />

      {/* SEZIONE 4: IL 6° CICLO */}
      <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-blue-50/70 via-zinc-50 to-amber-50/50 border border-blue-200 space-y-3">
        <div className="flex items-center gap-2 text-[#1c00ff] font-black text-base sm:text-lg">
          <Sparkles className="size-5" />
          <h3 className="text-base sm:text-lg font-black text-[#1c00ff]">
            Il Vostro 6° Ciclo: Chiusura Mesociclo, Trasformazione e Scarico Selettivo
          </h3>
        </div>
        <p className="text-zinc-800 text-[15px] sm:text-base leading-relaxed">
          Con il 5° ciclo abbiamo toccato il vero e proprio <strong>picco del nostro 2° Mesociclo</strong>: avete retto volumi impegnativi, combo complesse di potenza al Landmine, balistica e un lavoro muscolare ad altissima densità. Avete messo a dura prova il motore e il sistema nervoso.
        </p>
        <p className="text-zinc-800 text-[15px] sm:text-base leading-relaxed">
          Ora, con il <strong>6° ciclo</strong>, chiudiamo questo secondo blocco entrando nella fase di <strong>trasformazione e scarico selettivo (Modalità B)</strong>:
        </p>
        <ul className="list-disc pl-5 text-[15px] sm:text-base space-y-1.5 text-zinc-800 leading-relaxed">
          <li>
            <strong>Nessuno scarico passivo da divano:</strong> nel nostro metodo lo scarico non è fermarsi, ma fare una <em>staffetta intelligente</em>. I pattern motori e le articolazioni arrivati al picco di carico pesante cedono temporaneamente il passo a lavori di destrezza, controllo motorio, mobilità e propedeutiche tecniche.
          </li>
          <li>
            <strong>Fissare gli adattamenti:</strong> questa fase serve a smaltire la fatica sistemica accumulata nel 5° ciclo, consolidando la forza e la qualità neurale che avete costruito senza disperderla.
          </li>
          <li>
            <strong>Preparare il terreno:</strong> libereremo energia neurale e rigenereremo le strutture articolari per arrivare al via del 3° Mesociclo con una freschezza e una padronanza motoria di livello assoluto.
          </li>
        </ul>
        <div className="pt-3 text-[15px] sm:text-base font-bold text-zinc-900 border-t border-zinc-200 leading-relaxed">
          Le nozioni che abbiamo chiarito oggi — la precisione nell&apos;RPE, la disciplina nei recuperi e il rifiuto categorico di subire passivamente il carico — sono la chiave esatta per affrontare questo 6° ciclo al massimo del suo valore. <br />
          <span className="text-[#1c00ff] mt-2 block font-extrabold">Buon lavoro a tutti sul 6° ciclo: continuiamo a costruire atleti completi!</span>
        </div>
      </section>
    </article>
  );
}
