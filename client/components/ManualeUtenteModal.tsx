import React, { useState } from "react";
import {
  BookOpen,
  Calendar,
  Coins,
  Dumbbell,
  ShieldCheck,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  Info,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";

interface ManualeUtenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualeUtenteModal({ open, onOpenChange }: ManualeUtenteModalProps) {
  const [activeTab, setActiveTab] = useState<
    "prenotazioni" | "crediti" | "diario" | "metodologia" | "contatti"
  >("prenotazioni");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl [scrollbar-width:thin]">
        <DialogHeader className="mb-3 text-left">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#1c00ff] text-[#e3ff00] font-black shadow-xs">
                <BookOpen className="size-5" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#1c00ff]">
                  Guida Ufficiale Atleti
                </div>
                <DialogTitle className="text-xl font-black tracking-tight text-zinc-900">
                  Manuale Operativo Area46 Lab
                </DialogTitle>
              </div>
            </div>
            <img
              src="/logo-area46-transparent.png"
              alt="Area46 Landmine Lab"
              className="h-10 w-auto object-contain shrink-0 hidden sm:block drop-shadow-2xs"
            />
          </div>
          <DialogDescription className="text-xs text-zinc-500 leading-relaxed">
            Tutte le istruzioni, regole di prenotazione, scadenze, diario ed etica d&apos;allenamento.
          </DialogDescription>
        </DialogHeader>

        {/* TABS DI NAVIGAZIONE GUIDA */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-zinc-100 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveTab("prenotazioni")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "prenotazioni"
                ? "bg-[#1c00ff] text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <Calendar className="size-3.5" />
            <span>Prenotazioni</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("crediti")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "crediti"
                ? "bg-[#1c00ff] text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <Coins className="size-3.5" />
            <span>Crediti & Scadenze</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("diario")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "diario"
                ? "bg-[#1c00ff] text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <Copy className="size-3.5" />
            <span>Diario & Duplica</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("metodologia")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "metodologia"
                ? "bg-[#1c00ff] text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <Dumbbell className="size-3.5" />
            <span>Livello PRO (160 Ex)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("contatti")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "contatti"
                ? "bg-[#1c00ff] text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <Phone className="size-3.5" />
            <span>Contatti & Supporto</span>
          </button>
        </div>

        {/* CONTENUTO SCHEDE */}
        <div className="mt-3 text-xs text-zinc-700 leading-relaxed min-h-[300px]">
          {/* TAB 1: PRENOTAZIONI & CALENDARIO */}
          {activeTab === "prenotazioni" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Calendar className="size-4 text-[#1c00ff]" />
                  <span>Come Funziona la Prenotazione degli Slot</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  L&apos;accesso al Lab avviene esclusivamente su prenotazione oraria per garantire il
                  rapporto 1:1 o in piccoli gruppi guidati dal Coach Stefano Tronconi.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1">
                  <div className="font-bold text-zinc-900 flex items-center gap-2">
                    <span className="size-5 rounded-full bg-[#1c00ff] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>Prenotazione Singola o a Blocchi</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 ml-7">
                    Puoi prenotare i singoli slot navigando il calendario settimanale, oppure attivare la
                    funzione <strong>Prenotazione Multipla Rapida</strong> per bloccare con una spunta
                    i tuoi giorni e orari preferiti su più settimane consecutive.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1">
                  <div className="font-bold text-zinc-900 flex items-center gap-2">
                    <span className="size-5 rounded-full bg-[#1c00ff] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>Termini di Anticipo Prenotazione</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 ml-7 leading-relaxed">
                    Le sessioni devono essere prenotate nel rispetto del <strong>limite di preavviso stabilito dal Lab</strong> prima
                    dell&apos;inizio del turno (il sistema segnala e blocca in automatico gli slot non più prenotabili a ridosso dell&apos;orario).
                    Ti raccomandiamo di pianificare sempre con congruo anticipo per consentire al coach il setup ottimale delle postazioni
                    e assicurarti la pedana desiderata.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1">
                  <div className="font-bold text-zinc-900 flex items-center gap-2">
                    <span className="size-5 rounded-full bg-[#1c00ff] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span>Politica di Cancellazione & Rimborso</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 ml-7">
                    Puoi annullare liberamente la tua prenotazione fino a <strong>24 ore prima</strong> (o secondo la
                    policy concordata con il coach). Il credito ti viene riaccreditato istantaneamente sul wallet.
                    Le cancellazioni tardive (sotto il limite orario) comportano la trattenuta del credito per rispetto
                    degli altri atleti e dell&apos;organizzazione del Lab.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CREDITI & SCADENZE */}
          {activeTab === "crediti" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Coins className="size-4 text-[#1c00ff]" />
                  <span>Gestione Wallet, Crediti e Scadenze</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  La regola fondamentale: <strong>1 Credito = 1 Seduta di allenamento con Coach</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-bold text-zinc-900 block">Validità dei Pacchetti a Consumo</span>
                  <p className="text-[11px] text-zinc-600">
                    • <strong>Pacchetti 8 e 12 sedute:</strong> scadenza a <strong>4 settimane</strong>.<br />
                    • <strong>Pacchetti 24 e 36 sedute:</strong> scadenza a <strong>12 settimane</strong>.<br />
                    • <strong>Abbonamento Continuativo:</strong> durata 6 o 12 mesi con tutti gli slot bloccabili subito.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1">
                  <div className="font-black text-xs text-amber-900 flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-amber-700" />
                    Tutela in caso di Imprevisto del Coach & Roll-Over
                  </div>
                  <p className="text-[11px] text-amber-900/90 leading-relaxed">
                    Se per un imprevisto imprevedibile il Coach deve annullare una seduta:<br />
                    • Il credito viene <strong>sempre restituito al 100%</strong> al tuo wallet.<br />
                    • <strong>Abbonamenti Continuativi:</strong> la data di rinnovo mensile rimane fissa; il credito riaccreditato rimane utilizzabile liberamente per qualunque slot.<br />
                    • <strong>Pacchetti a Consumo (Lab 8, 12, 24, 36):</strong> se la scadenza è imminente (<strong>≤ 5 giorni</strong>), il sistema posticipa la scadenza di <strong>+7 giorni di calendario</strong> (1 intera settimana) per consentirti di recuperare nei tuoi orari abituali senza alterare il ritmo di frequenza (2x o 3x a settimana). Se la scadenza è a più di 5 giorni, resta invariata avendo già tempo per riprenotare.<br />
                    • <strong>Roll-Over sul Rinnovo:</strong> ogni credito residuo non fruito viene automaticamente preservato e trasferito nel nuovo pacchetto acquistato.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 space-y-1">
                  <div className="font-black text-xs text-blue-900 flex items-center gap-1.5">
                    <Sparkles className="size-4 text-[#1c00ff]" />
                    Chiusure Studio & Ferie Programmate
                  </div>
                  <p className="text-[11px] text-blue-900/90 leading-relaxed">
                    Tutti i periodi di ferie (estive, natalizie o festività) inseriti a calendario dal Lab
                    <strong> prorogano automaticamente di pari giorni</strong> la scadenza di tutti i pacchetti e degli
                    abbonamenti attivi. Zero perdite, massima correttezza.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIARIO & TASTO DUPLICA */}
          {activeTab === "diario" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Copy className="size-4 text-[#1c00ff]" />
                  <span>Diario di Allenamento & Tasto Duplica Rapido</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Registrare i parametri di carico è fondamentale per la progressione atletica. L&apos;app
                  è ottimizzata per farti risparmiare tempo prezioso durante la sessione.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1">
                  <div className="font-bold text-zinc-900 flex items-center gap-2">
                    <span className="p-1 rounded-md bg-[#e3ff00] text-zinc-950">
                      <Copy className="size-3.5" />
                    </span>
                    <span>Tasto Duplica Set Rapido</span>
                  </div>
                  <p className="text-[11px] text-zinc-600">
                    Quando completi una serie dello stesso esercizio con il medesimo carico e ripetizioni, non serve
                    ridigitare: premi il tasto <strong>&quot;Duplica Set&quot;</strong>. L&apos;app copierà istantaneamente i kg,
                    le ripetizioni e l&apos;RPE precedente creando una nuova serie pronta in un tocco.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-bold text-zinc-900 block">Parametri da Annotare</span>
                  <p className="text-[11px] text-zinc-600">
                    • <strong>KG (Carico effettivo al perno Landmine):</strong> escludi o includi il bilanciere secondo le indicazioni del coach.<br />
                    • <strong>REPS:</strong> ripetizioni completate a tecnica pulita.<br />
                    • <strong>RPE (Sforzo Percepito su scala 1-10):</strong> 7 = 3 ripetizioni di riserva, 8 = 2 di riserva, 9 = 1 di riserva, 10 = massimale.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-600">
                  💡 In caso di esercizi unilaterali o asimmetrici, l&apos;app usa la notazione con il segno <code>+</code> (es. <code>8+8</code> reps o <code>15&quot;+15&quot;</code> di tenuta isometrica).
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVELLO PRO & METODOLOGIA */}
          {activeTab === "metodologia" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-900 text-white space-y-1">
                <div className="font-black text-sm text-[#e3ff00] flex items-center gap-1.5">
                  <Dumbbell className="size-4 text-[#e3ff00]" />
                  <span>La Visione del Livello PRO & Catalogo 160 Esercizi</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Riservato agli atleti avanzati che hanno superato i livelli base ed entry level.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-bold text-zinc-900 block">1. Regola dei 60 Minuti Massimi</span>
                  <p className="text-[11px] text-zinc-600">
                    Ogni allenamento è progettato per durare al massimo 60 minuti, 100% attivo. Nessun tempo
                    morto o chiacchiere da palestra commerciale: focus totale, alta densità e flow continuo.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-bold text-zinc-900 block">2. Progressioni a Onde RPE</span>
                  <p className="text-[11px] text-zinc-600">
                    I fondamentali di forza seguono onde di carico crescenti (da RPE 7-8 a picco 9-10 con
                    diminuzione del volume), mentre i complementari lavorano a volume più alto per lo stimolo
                    strutturale ed estetico.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-bold text-zinc-900 block">3. Scarico Selettivo (Modalità B)</span>
                  <p className="text-[11px] text-zinc-600">
                    Al raggiungimento del picco di carico, il movimento pesante esce per un ciclo e viene sostituito
                    da lavoro qualitativo di destrezza motoria, coordinazione o mobilità articolare. Questo protegge
                    articolazioni e sistema nervoso evitando qualsiasi sovrallenamento.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CONTATTI & SUPPORTO */}
          {activeTab === "contatti" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Phone className="size-4 text-[#1c00ff]" />
                  <span>Contatti Diretti Coach & Sede Lab</span>
                </div>
                <p className="text-[11px] text-zinc-600">
                  Per qualunque dubbio su schede, carichi, cambi slot d&apos;emergenza o esigenze amministrative:
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[#1c00ff]/10 text-[#1c00ff] flex items-center justify-center shrink-0">
                    <Mail className="size-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Email Ufficiale Coach & Fatture
                    </span>
                    <a
                      href="mailto:firenzepersonaltrainer@gmail.com"
                      className="text-sm font-black text-zinc-900 hover:text-[#1c00ff] transition-colors"
                    >
                      firenzepersonaltrainer@gmail.com
                    </a>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[#e3ff00] text-zinc-950 flex items-center justify-center shrink-0 border border-zinc-900">
                    <Phone className="size-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Telefono & WhatsApp Studio
                    </span>
                    <a
                      href="tel:+393400000000"
                      className="text-sm font-black text-zinc-900 hover:text-[#1c00ff] transition-colors"
                    >
                      +39 340 0000000
                    </a>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                    <MapPin className="size-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Sede Area46 Landmine Lab
                    </span>
                    <span className="text-sm font-black text-zinc-900">
                      Via del Landmine 46, Firenze
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-end">
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-zinc-900 text-white hover:bg-zinc-800 font-bold text-xs px-5 h-9 rounded-xl shadow-xs"
          >
            Ho Capito, Chiudi Manuale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
