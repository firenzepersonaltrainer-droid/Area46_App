import React from "react";
import {
  Sparkles,
  CalendarCheck,
  Zap,
  Gift,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Bot,
  Percent,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";

interface InfoContinuativoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPack?: (packId: string) => void;
}

export function InfoContinuativoModal({
  open,
  onOpenChange,
  onSelectPack,
}: InfoContinuativoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl [scrollbar-width:thin]">
        <DialogHeader className="mb-3 text-left">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#e3ff00] text-zinc-950 font-black border border-zinc-900 shadow-xs">
                <Sparkles className="size-5 text-[#1c00ff]" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#1c00ff]">
                  Formula All-Inclusive Esclusiva
                </div>
                <DialogTitle className="text-xl font-black tracking-tight text-zinc-900">
                  Abbonamento Lab Continuativo
                </DialogTitle>
              </div>
            </div>
            <img
              src="/logo-area46-transparent.png"
              alt="Area46"
              className="h-10 w-auto object-contain shrink-0 hidden sm:block drop-shadow-2xs"
            />
          </div>
          <DialogDescription className="text-xs text-zinc-600 leading-relaxed">
            La formula ideata da Coach Stefano Tronconi per gli atleti che vogliono costanza,
            slot prioritari garantiti e il massimo vantaggio economico possibile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs text-zinc-700">
          {/* I 4 PILASTRI DELL'ABBONAMENTO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
              <div className="flex items-center gap-1.5 font-black text-zinc-900">
                <CalendarCheck className="size-4 text-[#1c00ff]" />
                <span>Posto Fisso Garantito</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Puoi bloccare tutti i tuoi slot (fino a 104 o 156 sessioni) fin dal primo giorno,
                garantendoti il tuo orario preferito senza rischi di sovraffollamento.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
              <div className="flex items-center gap-1.5 font-black text-zinc-900">
                <Bot className="size-4 text-[#1c00ff]" />
                <span>Assistente AI Booking</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                <strong>Benefit esclusivo:</strong> prenota, sposta o cancella le tue sessioni parlando
                con l&apos;assistente AI intelligente (es. &quot;Prenota lunedì e venerdì alle 18:00 fino a Pasqua&quot;).
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
              <div className="flex items-center gap-1.5 font-black text-zinc-900">
                <Percent className="size-4 text-emerald-600" />
                <span>Tariffa Bloccata e Scontata</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Risparmi fino a <strong>840 € all&apos;anno</strong> rispetto ai pacchetti a consumo.
                La quota mensile resta bloccata e protetta da aumenti per tutta la durata del contratto.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
              <div className="flex items-center gap-1.5 font-black text-zinc-900">
                <ShieldCheck className="size-4 text-[#1c00ff]" />
                <span>Tutela Ferie e Chiusure</span>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Se lo studio chiude per ferie estive o festività, la durata del tuo abbonamento si
                prolunga in automatico: <strong>non perdi mai nemmeno una seduta</strong>.
              </p>
            </div>
          </div>

          {/* CONFRONTO: SEMESTRALE VS ANNUALE (PREMIO FEDELTÀ) */}
          <div className="mt-4 pt-3 border-t border-zinc-200">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 mb-2.5 flex items-center justify-between">
              <span>Scegli la durata del tuo accordo</span>
              <span className="text-[10px] font-bold text-[#1c00ff] bg-[#1c00ff]/10 px-2 py-0.5 rounded-full">
                Semestrale o Annuale
              </span>
            </h4>

            <div className="space-y-3">
              {/* ACCORDO ANNUALE 12 MESI - IL PIÙ VANTAGGIOSO */}
              <div className="p-4 rounded-2xl bg-zinc-950 text-white border-2 border-[#e3ff00] shadow-[0_0_20px_rgba(227,255,0,0.18)] relative overflow-hidden">
                <div className="absolute top-2 right-2">
                  <span className="bg-[#e3ff00] text-zinc-950 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-zinc-900 shadow-xs">
                    👑 PREMIO FEDELTÀ 12 MESI
                  </span>
                </div>

                <div className="text-sm font-black text-white flex items-center gap-2">
                  <span>Accordo Annuale (12 Mesi)</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5 mb-2.5">
                  Massima fedeltà = Massimi vantaggi economici e operativi
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 font-bold block">Frequenza 2X</span>
                    <span className="text-base font-black text-[#e3ff00]">230 €</span>
                    <span className="text-[10px] text-zinc-400"> / mese</span>
                    <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                      Risparmi 50€/m (600€/anno!)
                    </div>
                    <div className="text-[10px] text-zinc-400">104 slot bloccabili subito</div>
                  </div>

                  <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800">
                    <span className="text-[10px] text-zinc-400 font-bold block">Frequenza 3X</span>
                    <span className="text-base font-black text-[#e3ff00]">329 €</span>
                    <span className="text-[10px] text-zinc-400"> / mese</span>
                    <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                      Risparmi 70€/m (840€/anno!)
                    </div>
                    <div className="text-[10px] text-zinc-400">156 slot bloccabili subito</div>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-zinc-300 border-t border-zinc-800 pt-2.5">
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <Bot className="size-3.5 shrink-0 text-[#e3ff00]" />
                    <span>Assistente AI Booking Concierge Illimitato</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-[#e3ff00]">
                    <Sparkles className="size-3.5 shrink-0" />
                    <span>Miglior tariffa annuale garantita con massimo risparmio</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                    <span>Blocco completo per 365 giorni senza mai dover rincorrere le date</span>
                  </div>
                </div>
              </div>

              {/* ACCORDO SEMESTRALE 6 MESI */}
              <div className="p-3.5 rounded-2xl bg-white border border-zinc-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-zinc-900">Accordo Semestrale (6 Mesi)</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded-full">
                    Vincolo 6 Mesi
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 mb-2">
                  Ottimo equilibrio tra flessibilità e risparmio mensile
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 font-bold block">Frequenza 2X</span>
                    <span className="text-sm font-black text-zinc-900">250 €</span>
                    <span className="text-[10px] text-zinc-500"> / mese</span>
                    <div className="text-[10px] text-emerald-600 font-bold">Risparmio 30€/mese</div>
                    <div className="text-[10px] text-zinc-500">48 slot bloccabili subito</div>
                  </div>

                  <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                    <span className="text-[10px] text-zinc-500 font-bold block">Frequenza 3X</span>
                    <span className="text-sm font-black text-zinc-900">359 €</span>
                    <span className="text-[10px] text-zinc-500"> / mese</span>
                    <div className="text-[10px] text-emerald-600 font-bold">Risparmio 40€/mese</div>
                    <div className="text-[10px] text-zinc-500">72 slot bloccabili subito</div>
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-zinc-600 flex items-center gap-1 font-semibold">
                  <Bot className="size-3 text-[#1c00ff]" />
                  <span>Include Assistente AI Booking per tutta la durata</span>
                </div>
              </div>
            </div>
          </div>

          {/* COME AVVENGONO I PAGAMENTI & FATTURAZIONE */}
          <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-950 space-y-1.5">
            <div className="font-black text-xs text-blue-900 flex items-center gap-1.5">
              <Zap className="size-4 text-[#1c00ff]" />
              Come avvengono i pagamenti e la fatturazione?
            </div>
            <p className="text-[11px] leading-relaxed text-blue-900/90">
              Il pagamento avviene con addebito ricorrente automatico ogni 30 giorni tramite circuito Stripe
              certificato e sicuro. Ad ogni rinnovo mensile riceverai via email la notifica di addebito e
              la relativa fattura emessa da Stefano Tronconi.
            </p>
          </div>

          {/* TRASPARENZA & CLAUSOLA DI DISMISSIONE ANTICIPATA */}
          <div className="p-3.5 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-700 text-[11px] space-y-1">
            <span className="font-black text-zinc-900 block">
              Trasparenza contrattuale & Recesso anticipato
            </span>
            <p className="text-zinc-600 leading-relaxed">
              L&apos;impegno continuativo garantisce la tariffa agevolata e il blocco degli slot. In caso di
              dismissione anticipata prima del termine semestrale o annuale, decade lo sconto fruito sulle
              sedute effettuate che verranno ricalcolate a prezzo standard, con contestuale liberazione degli
              slot futuri a calendario.
            </p>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-zinc-100 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-zinc-600 hover:text-zinc-900"
          >
            Chiudi
          </Button>

          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false);
              if (onSelectPack) {
                onSelectPack("pack-continuativo-2x-annuale");
              }
            }}
            className="bg-[#1c00ff] text-[#e3ff00] hover:bg-[#1600cc] font-black text-xs px-4 h-9 rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <span>Vedi Pacchetti Continuativi</span>
            <ArrowRight className="size-3.5 text-[#e3ff00]" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
