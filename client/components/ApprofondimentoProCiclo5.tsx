import React, { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Sparkles,
  Flame,
  ShieldAlert,
  Zap,
  Clock,
  ArrowRight,
  Maximize2,
  CheckCircle2,
  Target,
  Brain,
  Layers,
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

  return (
    <div className="my-4">
      {/* BARRA MENU PRINCIPALE - STILE DEDICATO E DIFFERENZIATO */}
      <div
        onClick={() => setAperto((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setAperto((prev) => !prev);
          }
        }}
        className="rounded-xl px-4 py-3 flex items-center justify-between shadow-md cursor-pointer select-none transition-all hover:brightness-110 active:scale-[0.995]"
        style={{
          background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
          borderLeft: "5px solid #f59e0b",
          boxShadow: "0 4px 14px rgba(245, 158, 11, 0.15)",
        }}
        title="Clicca per aprire o comprimere questo approfondimento metodologico"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`size-4 text-[#f59e0b] transition-transform duration-200 ${
                !aperto ? "-rotate-90" : "rotate-0"
              }`}
            />
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-[#f59e0b]/20 text-[#f59e0b]">
                <BookOpen className="size-4" />
              </span>
              <span className="text-sm font-black uppercase tracking-wider text-white">
                Approfondimenti
              </span>
            </div>
          </div>

          <span
            className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-2xs"
            style={{
              background: "rgba(245, 158, 11, 0.2)",
              color: "#fbbf24",
              border: "1px solid rgba(245, 158, 11, 0.4)",
            }}
          >
            <Sparkles className="size-3 text-[#f59e0b]" />
            Verso la Maturità Atletica
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className="text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1.5"
            style={{ background: "#09090b", color: "#f59e0b", border: "1px solid rgba(245, 158, 11, 0.3)" }}
          >
            <Flame className="size-3" />
            Post 5° Ciclo
          </span>
          <span className="text-xs font-bold text-zinc-300 uppercase hidden sm:inline">
            {aperto ? "Comprimi" : "Leggi Articolo"}
          </span>
        </div>
      </div>

      {/* CONTENUTO ACCORDION INLINE */}
      {aperto && (
        <div
          className="mt-2 rounded-2xl p-5 sm:p-7 border transition-all animate-in fade-in duration-200"
          style={{
            background: "#09090b",
            borderColor: "rgba(245, 158, 11, 0.3)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setModalAperta(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
            >
              <Maximize2 className="size-3.5" />
              Modalità Lettura a Schermo Intero
            </button>
          </div>

          <ArticoloMaturitaAtletica />
        </div>
      )}

      {/* MODALE DI LETTURA IMMERSIVA A SCHERMO INTERO */}
      <Dialog open={modalAperta} onOpenChange={setModalAperta}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-zinc-950 text-zinc-100 rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-2xl [scrollbar-width:thin]">
          <DialogHeader className="mb-4 text-left border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-400">
              <BookOpen className="size-4" />
              Area46 Training Lab • Approfondimenti Livello PRO
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-white mt-1">
              Verso la Maturità Atletica: Guida, Metodo e Consapevolezza
            </DialogTitle>
          </DialogHeader>

          <ArticoloMaturitaAtletica />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArticoloMaturitaAtletica() {
  return (
    <article className="prose prose-invert max-w-none text-zinc-300 text-sm sm:text-base leading-relaxed space-y-6">
      {/* HEADER ARTICOLO */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-zinc-900 to-zinc-900/80 border border-amber-500/20">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider mb-2">
          <Sparkles className="size-4" />
          Comunicazione Tecnica e Metodologica del Coach
        </div>
        <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-snug">
          🚀 Verso la Maturità Atletica: Guida, Metodo e Consapevolezza dopo il 5° Ciclo
        </h1>
        <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
          <span className="font-bold text-amber-300">Coach Stefano Tronconi</span>
          <span>•</span>
          <span>Target: Atleti Livello PRO</span>
          <span>•</span>
          <span className="text-zinc-500">Transizione Ciclo 5 → Ciclo 6</span>
        </div>
      </div>

      {/* INCIPIT */}
      <div className="space-y-3 text-zinc-200">
        <p className="text-base sm:text-lg font-medium text-zinc-100 leading-relaxed">
          Ciao a tutti, <br />
          siamo arrivati alla conclusione del 5° ciclo di lavoro del livello pro... avete macinato fin qui moltissime ore di lavoro, avete costruito basi solide, assimilato i movimenti e iniziato a capire come risponde il vostro corpo.
        </p>
        <p>
          Adesso entriamo in una fase diversa del percorso: <strong className="text-amber-300">la fase della maturità atletica</strong>. <br />
          La differenza tra chi ottiene risultati straordinari e chi finisce semplicemente per &ldquo;stancarsi&rdquo; non sta nel cambiare continuamente esercizi, ma nella <strong className="text-white">qualità, nella precisione e nell&apos;intenzione</strong> con cui si affronta ogni singola ripetizione.
        </p>
        <p className="font-semibold text-amber-200">
          Ci sono tre nozioni chiave che voglio facciate vostri per affrontare i prossimi cicli con un livello superiore di consapevolezza:
        </p>
      </div>

      <hr className="border-zinc-800" />

      {/* SEZIONE 1: RPE */}
      <section className="space-y-5">
        <div className="flex items-center gap-2.5 text-lg sm:text-xl font-black text-white">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-black text-sm">
            1
          </span>
          <h2 className="text-lg sm:text-xl font-black text-white">L’RPE: Lo strumento per governare lo stimolo (e non subirlo)</h2>
        </div>

        <p>
          Nelle schede trovate sempre più spesso l&apos;indicazione <strong className="text-white">RPE</strong> (<em>Rating of Perceived Exertion</em>). Non è una sigla per complicarvi la vita, ma il nostro principale strumento per dosare lo stimolo.
        </p>

        {/* BOX TRAUMA CONTROLLATO */}
        <div className="rounded-xl p-4 bg-zinc-900/90 border border-zinc-700/60 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Brain className="size-4.5" />
            <h3 className="font-bold text-amber-400 text-sm">L’allenamento è un &ldquo;trauma programmato&rdquo;: la consapevolezza dello sforzo</h3>
          </div>
          <p className="text-xs sm:text-sm text-zinc-300">
            Il nostro corpo è un sistema biologico conservativo: non ha alcun interesse a costruire nuovo tessuto muscolare o aumentare la forza a meno che non sia strettamente costretto a farlo. <br />
            L&apos;allenamento, biologicamente parlando, <strong className="text-zinc-100">deve rappresentare uno stimolo di rottura, un piccolo trauma controllato per i nostri sistemi</strong> (muscolare, tendineo e nervoso). Solo se riceve questo segnale di allarme il corpo reagisce adattandosi e migliorando.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="rounded-lg p-3 bg-red-950/30 border border-red-500/30 text-red-200">
              <strong className="block text-red-400 font-bold mb-1">❌ Carichi troppo leggeri</strong>
              Se una serie è troppo facile (RPE 5-6 quando è richiesto 8), per il corpo è ordinaria amministrazione. Zero allarme, zero adattamento. Si perde tempo.
            </div>
            <div className="rounded-lg p-3 bg-red-950/30 border border-red-500/30 text-red-200">
              <strong className="block text-red-400 font-bold mb-1">❌ Strafare a ogni costo</strong>
              Oltrepassare costantemente il limite porta al cedimento scomposto, distrugge la tecnica e sovraccarica le articolazioni senza stimolo aggiuntivo utile.
            </div>
            <div className="rounded-lg p-3 bg-emerald-950/30 border border-emerald-500/30 text-emerald-200">
              <strong className="block text-emerald-400 font-bold mb-1">✅ La Consapevolezza</strong>
              Imparare a riconoscere e cercare attivamente quella specifica soglia di fatica in cui il corpo lavora davvero vicino al limite, mantenendo sempre il controllo.
            </div>
          </div>
        </div>

        {/* SCALA RPE */}
        <div className="rounded-xl p-4 bg-zinc-900/60 border border-zinc-800 space-y-3">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <Layers className="size-4 text-amber-400" />
            La scala RPE in sintesi (Reps in Reserve - RIR)
          </h4>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <span className="font-black text-red-400">RPE 10</span>
              <span className="text-zinc-200">Cedimento tecnico. Zero ripetizioni di riserva possibili.</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <span className="font-black text-orange-400">RPE 9</span>
              <span className="text-zinc-200">Potevate completare ancora <strong>1</strong> ripetizione pulita.</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <span className="font-black text-amber-400">RPE 8</span>
              <span className="text-zinc-200">Potevate completare ancora <strong>2</strong> ripetizioni pulite.</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="font-black text-emerald-400">RPE 7</span>
              <span className="text-zinc-200">Potevate completare ancora <strong>3</strong> ripetizioni (movimento fluido e brillante).</span>
            </div>
          </div>
        </div>

        {/* LA REGOLA D'ORO */}
        <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/40 space-y-2">
          <h4 className="font-black text-amber-300 text-sm flex items-center gap-2">
            <Target className="size-4.5" />
            La regola d&apos;oro: l&apos;RPE è PIÙ IMPORTANTE del numero di ripetizioni prescritte
          </h4>
          <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
            La scheda vi indica un numero di ripetizioni (ad esempio 6 rep), ma l&apos;obiettivo primario è <strong>il livello di stimolo (RPE)</strong>:
          </p>
          <ul className="list-disc pl-5 text-xs sm:text-sm space-y-1.5 text-zinc-300">
            <li>
              Se avete in scheda un <strong>3x6 @ RPE 8</strong>, ma alla <strong>5ª ripetizione</strong> sentite che la velocità è crollata e ne avete soltanto altre 2 di riserva: <strong>ci si ferma a 5 ripetizioni</strong>. Forzare la sesta significherebbe trasformare la serie in un RPE 9 o 10, sforando la fatica programmata.
            </li>
            <li>
              Al contrario: se arrivate alla <strong>6ª ripetizione</strong> e vi accorgete di essere ancora troppo freschi (avreste ancora 4 o 5 ripetizioni in riserva): <strong>continuate per 1 o 2 ripetizioni in più</strong>, andando a cogliere l&apos;RPE 8 target.
            </li>
          </ul>
          <p className="text-xs text-amber-200 font-semibold pt-1">
            💡 Muoversi con una flessibilità di <strong>± 1-2 ripetizioni</strong> rispetto a quanto scritto è il modo corretto di allenarsi per centrare lo stimolo esatto. Se la differenza fosse maggiore di 2 ripetizioni, significa che il carico scelto era totalmente fuori target e andrà corretto nella serie successiva.
          </p>
        </div>

        {/* FATICA SISTEMICA VS FATICA MUSCOLARE */}
        <div className="space-y-3">
          <h4 className="font-bold text-white text-sm">
            Dove serve l&apos;RPE, dove si può spingere e dove NON si usa: Fatica Sistemica vs Fatica Muscolare
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
            <div className="rounded-xl p-3.5 bg-zinc-900 border border-zinc-800 space-y-1.5">
              <strong className="block text-red-400 font-bold">1. Fatica Sistemica (I Fondamentali)</strong>
              <p className="text-zinc-300 text-xs">
                Nei grandi esercizi complessi (Panca, Landmine Deadlift, Landmine Press, Biker Squat, Pull-up, ecc.), lo sforzo coinvolge tutto il corpo e il sistema nervoso. Qui l&apos;RPE è <strong>tassativo</strong>: esagerare genera una fatica sistemica pesante che richiede giorni per essere smaltita e aumenta i compensi pericolosi.
              </p>
            </div>
            <div className="rounded-xl p-3.5 bg-zinc-900 border border-zinc-800 space-y-1.5">
              <strong className="block text-amber-400 font-bold">2. Fatica Muscolare (Complementari)</strong>
              <p className="text-zinc-300 text-xs">
                Negli esercizi con manubri, cavi o kettlebell, la fatica è quasi esclusivamente locale a carico del singolo muscolo. L&apos;impatto sul sistema nervoso è ridotto, ed è per questo che qui ci si può spingere verso RPE più alti per ricercare il pieno esaurimento muscolare.
              </p>
            </div>
            <div className="rounded-xl p-3.5 bg-zinc-900 border border-zinc-800 space-y-1.5">
              <strong className="block text-blue-400 font-bold">3. Dove NON chiediamo l&apos;RPE</strong>
              <p className="text-zinc-300 text-xs">
                In lavori balistici, pliometrici, di velocità, reattività o nei circuiti dinamici, l&apos;RPE a cedimento non avrebbe alcun senso. L&apos;obiettivo è <strong>freschezza neurale, velocità esecutiva e reattività elastica</strong>. Chiedere un RPE vicino al limite distruggerebbe lo scopo del gesto.
              </p>
            </div>
          </div>
        </div>

        {/* RAMPING / SERIE DI AVVICINAMENTO */}
        <div className="rounded-xl p-4 bg-zinc-900/80 border border-zinc-800 space-y-2.5">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <Clock className="size-4 text-amber-400" />
            Serie di Avvicinamento (Ramping): A cosa servono e come gestirle
          </h4>
          <p className="text-xs sm:text-sm text-zinc-300">
            Le serie di avvicinamento non sono serie allenanti anticipate e non servono a fare volume:
          </p>
          <ul className="list-disc pl-5 text-xs sm:text-sm space-y-1 text-zinc-300">
            <li><strong>Meccanicamente:</strong> aumentano la temperatura interna, distribuiscono il liquido sinoviale nelle articolazioni, elasticizzano i tendini e oliano il binario motorio.</li>
            <li><strong>A livello nervoso:</strong> svegliano il sistema nervoso centrale, aumentando il reclutamento delle fibre senza traumi improvvisi.</li>
            <li><strong>NON devono stancare:</strong> <strong>si eseguono sempre a bassissime ripetizioni (da 4-6 rep a scendere fino a 1-2 man mano che ci si avvicina al target)</strong> salendo gradualmente di peso. Mai fiatone o lattato.</li>
            <li><strong>I recuperi:</strong> 30-45&quot; con carichi bassi; 60-90&quot; avvicinandosi alla prima serie allenante per partire al 100%.</li>
            <li><strong>La differenza di scala:</strong> chi punta a <strong>30 kg</strong> sarà pronto con 1 o 2 serie rapide; chi punta a <strong>120 kg</strong> necessita di 4 o 5 serie progressive per preparare capsule e tendini in totale sicurezza.</li>
          </ul>
        </div>

        {/* RPE IN OGNI SERIE VS ALL'ULTIMA SERIE */}
        <div className="rounded-xl p-4 bg-zinc-900 border border-zinc-800 space-y-2">
          <h4 className="font-bold text-white text-sm">
            RPE in OGNI serie vs RPE all&apos;ULTIMA serie
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <strong className="block text-zinc-200 font-bold mb-1">RPE all&apos;ULTIMA serie:</strong>
              Individuare un carico fisso e, mantenendolo per tutte le serie, arrivare a toccare l&apos;RPE target solo all&apos;ultima ripetizione dell&apos;ultima serie. Le prime serie fanno da accumulo.
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <strong className="block text-amber-300 font-bold mb-1">RPE in OGNI serie (focus attuale):</strong>
              Già dalla prima serie allenante dovete essere al livello di fatica prescritto (es. RPE 8). Poiché tra le serie si accumula fatica, siate pronti, se necessario, a togliere una piccola percentuale di peso per conservare il medesimo grado di stimolo e di velocità.
            </div>
          </div>
        </div>
      </section>

      <hr className="border-zinc-800" />

      {/* SEZIONE 2: DECIFRARE LA SCHEDA */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 text-lg sm:text-xl font-black text-white">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-black text-sm">
            2
          </span>
          <h2 className="text-lg sm:text-xl font-black text-white">Decifrare la Scheda: Parametri e Recuperi senza dubbi</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-4 bg-zinc-900 border border-zinc-800 space-y-2 text-xs sm:text-sm">
            <h4 className="font-bold text-white">&ldquo;3 × 8&rdquo; oppure &ldquo;3 × 8+8&rdquo;</h4>
            <p className="text-zinc-300">
              <strong>3 × 8:</strong> 3 serie da 8 ripetizioni in un movimento in cui il lavoro viene svolto contemporaneamente su entrambi i lati del corpo. 8 ripetizioni fatte, serie conclusa.
            </p>
            <p className="text-zinc-300">
              <strong>3 × 8+8:</strong> È l&apos;indicazione inequivocabile di un esercizio <strong>unilaterale</strong>. Significa <strong>8 ripetizioni con il primo lato + 8 ripetizioni con il secondo lato</strong>. Entrambi i lati devono essere completati per chiudere la serie.
            </p>
          </div>

          <div className="rounded-xl p-4 bg-zinc-900 border border-zinc-800 space-y-2 text-xs sm:text-sm">
            <h4 className="font-bold text-white">I Recuperi: &ldquo;Rec&rdquo; vs &ldquo;RBS&rdquo;</h4>
            <p className="text-zinc-300">
              <strong>Rec (Recupero tra le serie):</strong> Pausa al termine dell&apos;intera serie prima di ripartire con il giro successivo. Serve a rigenerare l&apos;ATP/CP e la concentrazione. Non va accorciato per fare prima.
            </p>
            <p className="text-zinc-300">
              <strong>RBS (Rest Between Sides - Recupero tra i lati):</strong> Negli unilaterali, passare a zero secondi tra un arto e l&apos;altro penalizza il secondo lato. Se trovate scritto <strong>RBS (es. 30&quot;-45&quot;)</strong>: fate il primo lato (meglio partire dal debole), prendete i 30-45&quot; di RBS, fate il secondo lato e solo dopo fate partire il <strong>Rec</strong> standard.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-zinc-800" />

      {/* SEZIONE 3: MINDSET */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 text-lg sm:text-xl font-black text-white">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-black text-sm">
            3
          </span>
          <h2 className="text-lg sm:text-xl font-black text-white">Il Mindset e l&apos;Intenzione Esecutiva</h2>
        </div>

        <blockquote className="rounded-2xl p-5 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-l-4 border-amber-400 text-base sm:text-lg font-black text-amber-200 italic leading-snug">
          &ldquo;Non pensare a quale effetto l&apos;allenamento ha sul tuo corpo; preoccupati di quale effetto il tuo corpo deve avere sull&apos;allenamento.&rdquo;
        </blockquote>

        <p className="text-zinc-300">
          Questa frase racchiude il confine tra chi ottiene trasformazioni reali e chi si limita a &ldquo;fare presenza&rdquo;.
        </p>

        <div className="rounded-xl p-4 bg-zinc-900 border border-zinc-800 space-y-2 text-xs sm:text-sm">
          <p className="font-bold text-white">
            Il cervello umano è programmato per economizzare energia. Di fronte al carico e alla fatica che cresce, cerca istintivamente scorciatoie:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-zinc-300">
            <li>Tagliare gli ultimi centimetri di accosciata per non finire nel punto più profondo;</li>
            <li><strong className="text-amber-300">Cedere passivamente alla forza di gravità nella fase eccentrica</strong>, lasciando cadere il carico verso il basso senza controllarlo per evitare l&apos;allungamento sotto tensione;</li>
            <li>Rimbalzare a inizio spinta anziché invertire il carico con forza attiva;</li>
            <li>Ridurre l&apos;estensione articolare per sfuggire al tratto di movimento in cui il muscolo brucia di più.</li>
          </ul>
          <p className="pt-1 text-amber-200 font-semibold">
            In tutti questi casi state fuggendo proprio dal settore in cui si genera il vero stimolo muscolare, solo per non fare fatica. <br />
            <strong>Spostare un peso dal punto A al punto B senza controllo è pura inerzia; dominare la traiettoria e imporre la tensione muscolare contro la gravità è allenamento vero.</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <strong className="block text-amber-400 font-bold mb-1">1. Limite Tecnico</strong>
            Pretendete che l&apos;ultima ripetizione abbia la stessa precisione e pulizia della prima, a prescindere dal peso.
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <strong className="block text-amber-400 font-bold mb-1">2. Limite Motorio</strong>
            Sentite il corpo che governa il carico in ogni millimetro del movimento, soprattutto nella discesa, rifiutando ogni cedimento passivo.
          </div>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <strong className="block text-amber-400 font-bold mb-1">3. Limite di Intensità</strong>
            Imparate a non fermarvi non appena compare il disagio. È nel saper governare quel disagio che si costruisce la crescita fisica e mentale.
          </div>
        </div>
      </section>

      <hr className="border-zinc-800" />

      {/* SEZIONE 4: IL 6° CICLO */}
      <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-amber-950/20 border border-amber-500/30 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-black text-base sm:text-lg">
          <Flame className="size-5" />
          <h3 className="text-base sm:text-lg font-black text-amber-400">🎯 Il Vostro 6° Ciclo: Chiusura Mesociclo, Trasformazione e Scarico Selettivo</h3>
        </div>
        <p className="text-zinc-200 text-xs sm:text-sm leading-relaxed">
          Con il 5° ciclo abbiamo toccato il vero e proprio <strong>picco del nostro 2° Mesociclo</strong>: avete retto volumi impegnativi, combo complesse di potenza al Landmine, balistica e un lavoro muscolare ad altissima densità. Avete messo a dura prova il motore e il sistema nervoso.
        </p>
        <p className="text-zinc-200 text-xs sm:text-sm leading-relaxed">
          Ora, con il <strong>6° ciclo</strong>, chiudiamo questo secondo blocco entrando nella fase di <strong>trasformazione e scarico selettivo (Modalità B)</strong>:
        </p>
        <ul className="list-disc pl-5 text-xs sm:text-sm space-y-1.5 text-zinc-300">
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
        <div className="pt-2 text-xs sm:text-sm font-bold text-amber-300 border-t border-zinc-800/80">
          Le nozioni che abbiamo chiarito oggi — la precisione nell&apos;RPE, la disciplina nei recuperi e il rifiuto categorico di subire passivamente il carico — sono la chiave esatta per affrontare questo 6° ciclo al massimo del suo valore. <br />
          <span className="text-white mt-1 block">Buon lavoro a tutti sul 6° ciclo: continuiamo a costruire atleti completi!</span>
        </div>
      </section>
    </article>
  );
}
