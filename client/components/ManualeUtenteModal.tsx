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
    "allenamenti" | "timer" | "prenotazioni" | "crediti" | "contatti"
  >("allenamenti");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-2xl [scrollbar-width:thin]">
        <DialogHeader className="mb-2 text-left">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#1c00ff] text-[#e3ff00] font-black shadow-xs">
                <BookOpen className="size-5" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-[#1c00ff]">
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
            Istruzioni complete per l&apos;uso dell&apos;app, schede di allenamento, timer, diario, prenotazioni e contatti.
          </DialogDescription>
        </DialogHeader>

        {/* TABS DI NAVIGAZIONE GUIDA */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-zinc-100 [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveTab("allenamenti")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "allenamenti"
                ? "bg-[#1c00ff] text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <Dumbbell className="size-3.5" />
            <span>Allenamenti & Schede</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timer")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === "timer"
                ? "bg-[#1c00ff] text-white shadow-xs"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            <Clock className="size-3.5" />
            <span>Timer & Cronometro</span>
          </button>

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
            <span>Prenotazioni & Policy</span>
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
            <span>Crediti & Pacchetti</span>
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
            <span>Contatti Supporto</span>
          </button>
        </div>

        {/* CONTENUTO SCHEDE */}
        <div className="mt-2 text-xs text-zinc-700 leading-relaxed overflow-y-auto max-h-[58vh] pr-1">
          {/* TAB 1: ALLENAMENTI & SCHEDE */}
          {activeTab === "allenamenti" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Dumbbell className="size-4 text-[#1c00ff]" />
                  <span>Come Fruire delle Schede di Allenamento</span>
                </div>
                <p className="text-xs text-zinc-600">
                  L&apos;applicazione ti guida passo dopo passo in ogni singola seduta di allenamento con sequenze chiare e video esplicativi.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-black text-sm text-zinc-900 block">1. Selezione del Giorno e dei Blocchi</span>
                  <p className="text-xs text-zinc-600">
                    Dalla schermata principale trovi tutti i giorni del ciclo. Cliccando su un giorno accedi alla sequenza degli esercizi:
                    fondamentali pesanti, circuiti a tempo (AMRAP, EMOM), lavori di destrezza motoria o intervalli.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-black text-sm text-zinc-900 block">2. Video Dimostrativi (Orizzontale & Verticale)</span>
                  <p className="text-xs text-zinc-600">
                    All&apos;interno di ogni esercizio trovi il video dimostrativo con esecuzione tecnica curata dal Coach.
                    Puoi selezionare la visualizzazione in <strong>16:9 Orizzontale</strong> o in <strong>9:16 Verticale Shorts</strong> per la migliore comodità su smartphone.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-black text-sm text-zinc-900 block">3. Registrazione Carichi & Tasto Duplica Set</span>
                  <p className="text-xs text-zinc-600">
                    Toccando <strong>&quot;Registra Carico&quot;</strong> inserisci i kg utilizzati, le ripetizioni completate e lo sforzo percepito (RPE).
                    Se esegui più serie con lo stesso carico, tocca l&apos;icona <strong>Duplica Set</strong> per copiare istantaneamente i valori senza doverli riscrivere a mano.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TIMER & CRONOMETRO */}
          {activeTab === "timer" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Clock className="size-4 text-[#1c00ff]" />
                  <span>Funzionamento del Timer Integrato Flottante</span>
                </div>
                <p className="text-xs text-zinc-600">
                  Il timer rimane sempre a tua disposizione sullo schermo: non si interrompe cambiando schermata ed è completamente trascinabile.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-black text-sm text-zinc-900 block">Modalità Countdown (Recuperi)</span>
                  <p className="text-xs text-zinc-600">
                    Ideale per i tempi di recupero tra le serie. Puoi regolare la durata toccando i pulsanti rapidi da <strong>+5&quot;</strong>, <strong>-5&quot;</strong> e <strong>+60&quot;</strong>.
                    Un segnale acustico tipo fischietto sportivo ti avviserà negli ultimi 3 secondi e allo scadere del tempo.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-black text-sm text-zinc-900 block">Modalità Interval Training (Circuiti Multi-Fase)</span>
                  <p className="text-xs text-zinc-600">
                    Progettata per circuiti con tempi differenti (es. Esercizio 1 per 30&quot;, Esercizio 2 per 45&quot;, Pausa per 20&quot;).
                    Puoi aggiungere quante fasi desideri, differenziare la durata di ciascuna, alternare lavoro e pausa, e impostare il numero totale di round.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-black text-sm text-zinc-900 block">Icona Trascinabile & Riposizionamento</span>
                  <p className="text-xs text-zinc-600">
                    Puoi trascinare l&apos;icona del timer in qualsiasi punto dello schermo per non coprire i testi.
                    Ogni volta che chiudi il timer, l&apos;icona si riposiziona automaticamente nel suo punto originale in basso a destra.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRENOTAZIONI & POLICY */}
          {activeTab === "prenotazioni" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Calendar className="size-4 text-[#1c00ff]" />
                  <span>Prenotazioni Slot & Policy 24 Ore</span>
                </div>
                <p className="text-xs text-zinc-600">
                  Regole trasparenti per la massima serenità degli atleti e l&apos;organizzazione impeccabile del Lab.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <div className="font-bold text-zinc-900 flex items-center gap-2">
                    <span className="size-5 rounded-full bg-[#1c00ff] text-white text-xs font-black flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span>Termine di Prenotazione: Default 24 Ore</span>
                  </div>
                  <p className="text-xs text-zinc-600 ml-7 leading-relaxed">
                    Gli slot di allenamento devono essere prenotati con un preavviso minimo di <strong>24 ore</strong> dall&apos;inizio del turno.
                    Non è consentito prenotare a meno di 24 ore dall&apos;appuntamento, salvo accordi diretti con il Coach.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <div className="font-bold text-zinc-900 flex items-center gap-2">
                    <span className="size-5 rounded-full bg-[#1c00ff] text-white text-xs font-black flex items-center justify-center shrink-0">
                      2
                    </span>
                    <span>Termine di Disdetta: Default 24 Ore</span>
                  </div>
                  <p className="text-xs text-zinc-600 ml-7 leading-relaxed">
                    Puoi disdire liberamente qualsiasi prenotazione con almeno <strong>24 ore di anticipo</strong> rispetto all&apos;orario fissato.
                    Il credito viene riaccreditato istantaneamente sul tuo wallet.
                    Le disdette comunicate con meno di 24 ore di preavviso comportano la perdita del credito.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <div className="font-bold text-zinc-900 flex items-center gap-2">
                    <span className="size-5 rounded-full bg-[#1c00ff] text-white text-xs font-black flex items-center justify-center shrink-0">
                      3
                    </span>
                    <span>Prenotazione Multipla & Ricorrente</span>
                  </div>
                  <p className="text-xs text-zinc-600 ml-7">
                    Utilizza la funzione di prenotazione per bloccare i tuoi orari fissi su più settimane consecutive garantendoti sempre il posto preferito.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CREDITI & PACCHETTI */}
          {activeTab === "crediti" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Coins className="size-4 text-[#1c00ff]" />
                  <span>Gestione Wallet, Crediti e Scadenze</span>
                </div>
                <p className="text-xs text-zinc-600">
                  La regola fondamentale: <strong>1 Credito = 1 Seduta di allenamento con Coach</strong>.
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 space-y-1">
                  <span className="font-bold text-zinc-900 block">Validità dei Pacchetti a Consumo</span>
                  <p className="text-xs text-zinc-600">
                    • <strong>Pacchetti 8 e 12 sedute:</strong> validità <strong>4 settimane</strong>.<br />
                    • <strong>Pacchetti 24 e 36 sedute:</strong> validità <strong>12 settimane</strong>.<br />
                    I crediti residui possono essere visualizzati in qualsiasi momento nella barra wallet in cima allo schermo.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-950 space-y-1">
                  <div className="font-black text-xs text-blue-900 flex items-center gap-1.5">
                    <Sparkles className="size-4 text-[#1c00ff]" />
                    Chiusure Studio & Ferie Programmate
                  </div>
                  <p className="text-xs text-blue-900/90 leading-relaxed">
                    Tutti i periodi di ferie (estive, natalizie o festività) inseriti a calendario dal Lab
                    <strong> prorogano automaticamente di pari giorni</strong> la scadenza di tutti i pacchetti attivi. Zero perdite, massima correttezza.
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
                  <span>Contatti Diretti Coach Area46</span>
                </div>
                <p className="text-xs text-zinc-600">
                  Per qualsiasi necessità su allenamenti, cambi orario o supporto per l&apos;uso dell&apos;app:
                </p>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-[#1c00ff]/10 text-[#1c00ff] flex items-center justify-center shrink-0">
                    <Mail className="size-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                      Email Ufficiale Coach
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
                  <div className="size-11 rounded-2xl bg-[#e3ff00] text-zinc-950 flex items-center justify-center shrink-0 border border-zinc-900">
                    <Phone className="size-5 text-zinc-950" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                      WhatsApp & Telefono Diretto
                    </span>
                    <a
                      href="https://wa.me/393920111410"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-black text-zinc-900 hover:text-[#1c00ff] transition-colors"
                    >
                      3920111410
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-end shrink-0">
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
