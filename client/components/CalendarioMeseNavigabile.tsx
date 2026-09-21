import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Button } from "./Button";
import {
  hasGiornoPalinsesto,
  REGOLA_DEFAULT_LANDMINE,
  RegolaPalinsesto,
} from "../lib/palinsesto";

export interface CalendarioPrenotazioneInfo {
  id: string;
  data: string; // YYYY-MM-DD
  orario: string;
  email_cliente: string;
  nome_cliente: string;
  stato: string;
}

export interface CalendarioEccezioneInfo {
  id: string;
  data: string; // YYYY-MM-DD
  orario?: string | null;
  tipo: "slot_straordinario" | "slot_bloccato" | "chiusura_giornata";
  motivo?: string;
}

interface CalendarioMeseNavigabileProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  prenotazioni?: CalendarioPrenotazioneInfo[];
  eccezioni?: CalendarioEccezioneInfo[];
  regole?: RegolaPalinsesto[];
  userEmail?: string;
  isManager?: boolean;
  minDate?: string;
  orariBaseCount?: number;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const NOMI_MESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const GIORNI_SETTIMANA_ABBR = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function CalendarioMeseNavigabile({
  selectedDate,
  onSelectDate,
  prenotazioni = [],
  eccezioni = [],
  regole = [REGOLA_DEFAULT_LANDMINE],
  userEmail,
  isManager = false,
  minDate,
  orariBaseCount = 18,
}: CalendarioMeseNavigabileProps) {
  // Modalità vista: 'mese' (griglia mensile interattiva) o 'settimana' (striscia 7 giorni)
  const [viewMode, setViewMode] = useState<"mese" | "settimana">("mese");

  // Mese e anno correntemente visualizzati nella griglia
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    const d = selectedDate ? new Date(selectedDate + "T00:00:00") : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const todayStr = useMemo(() => formatDateISO(new Date()), []);

  // Avanza / arretra mese
  const handlePrevMonth = () => {
    setCurrentViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  // Tasto Oggi
  const handleGoToday = () => {
    const now = new Date();
    const str = formatDateISO(now);
    setCurrentViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(str);
  };

  // Navigazione rapida a Giorni (+1 / -1 giorno)
  const handleStepDay = (delta: number) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const newStr = formatDateISO(d);
    onSelectDate(newStr);
    // Se cambia mese, aggiorna vista
    if (d.getMonth() !== currentViewDate.getMonth() || d.getFullYear() !== currentViewDate.getFullYear()) {
      setCurrentViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  // Navigazione rapida a Settimane (+7 / -7 giorni)
  const handleStepWeek = (deltaWeeks: number) => {
    handleStepDay(deltaWeeks * 7);
  };

  // Calcolo celle griglia mensile (giorni del mese + padding giorni feriali lun-dom)
  const gridCells = useMemo(() => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Dom, 1 = Lun...
    const mondayBasedFirstDay = (firstDayIndex + 6) % 7; // 0 = Lun, 6 = Dom

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
    }> = [];

    // Padding giorni mese precedente
    for (let i = mondayBasedFirstDay - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const d = new Date(year, month - 1, dNum);
      const str = formatDateISO(d);
      cells.push({
        dateStr: str,
        dayNum: dNum,
        isCurrentMonth: false,
        isToday: str === todayStr,
        isPast: str < todayStr,
      });
    }

    // Giorni mese corrente
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const str = formatDateISO(d);
      cells.push({
        dateStr: str,
        dayNum: day,
        isCurrentMonth: true,
        isToday: str === todayStr,
        isPast: str < todayStr,
      });
    }

    // Padding giorni mese successivo fino a completare le righe (multiplo di 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      const str = formatDateISO(d);
      cells.push({
        dateStr: str,
        dayNum: day,
        isCurrentMonth: false,
        isToday: str === todayStr,
        isPast: str < todayStr,
      });
    }

    return cells;
  }, [currentViewDate, todayStr]);

  // Calcolo giorni della settimana corrente centrata su selectedDate
  const weekDays = useMemo(() => {
    const curr = new Date(selectedDate + "T00:00:00");
    const dayOfWeek = (curr.getDay() + 6) % 7; // 0 = Lun
    const monday = new Date(curr);
    monday.setDate(curr.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const str = formatDateISO(d);
      days.push({
        dateStr: str,
        dayNum: d.getDate(),
        dayName: GIORNI_SETTIMANA_ABBR[i],
        isToday: str === todayStr,
        isPast: str < todayStr,
      });
    }
    return days;
  }, [selectedDate, todayStr]);

  // Indicatore per ciascuna data:
  const getDateStatus = (dateStr: string) => {
    const bookings = prenotazioni.filter((p) => p.data === dateStr && p.stato === "confermata");
    const exceptions = eccezioni.filter((e) => e.data === dateStr);
    const isChiuso = exceptions.some((e) => e.tipo === "chiusura_giornata");
    const hasBlocchi = exceptions.some((e) => e.tipo === "slot_bloccato");
    const haMiaPrenotazione = !!userEmail && bookings.some((b) => b.email_cliente === userEmail);
    const hasPalinsesto = hasGiornoPalinsesto(dateStr, regole) || exceptions.some((e) => e.tipo === "slot_straordinario");

    return {
      count: bookings.length,
      isChiuso,
      hasBlocchi,
      haMiaPrenotazione,
      hasPalinsesto,
      hasSlotsLiberi: !isChiuso && hasPalinsesto && bookings.length < orariBaseCount,
    };
  };

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 p-3.5 shadow-2xs space-y-3 select-none">
      {/* ─── BARRA 1: CONTROLLI NAVIGAZIONE MESE E TOGGLE ─────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        {/* TITOLO MESE / ANNO */}
        <div className="flex items-center gap-1.5">
          <div className="size-8 rounded-xl bg-[#1c00ff]/10 text-[#1c00ff] flex items-center justify-center font-black">
            <CalendarIcon className="size-4" />
          </div>
          <div>
            <div className="text-sm font-black text-zinc-900 leading-none">
              {NOMI_MESI[currentViewDate.getMonth()]} {currentViewDate.getFullYear()}
            </div>
            <div className="text-[10px] text-zinc-400 font-bold mt-0.5">
              Naviga per giorni, settimane o mese
            </div>
          </div>
        </div>

        {/* CONTROLLI MESE (<, Oggi, >) & TOGGLE VISTA */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrevMonth}
            className="h-7 w-7 p-0 rounded-lg hover:bg-zinc-100 text-zinc-700"
            title="Mese precedente"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGoToday}
            className="h-7 px-2 text-[11px] font-black rounded-lg border-zinc-300 text-zinc-700 hover:bg-zinc-100"
          >
            Oggi
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleNextMonth}
            className="h-7 w-7 p-0 rounded-lg hover:bg-zinc-100 text-zinc-700"
            title="Mese successivo"
          >
            <ChevronRight className="size-4" />
          </Button>

          {/* TOGGLE VISTA MESE / SETTIMANA */}
          <div className="flex bg-zinc-100 p-0.5 rounded-lg ml-1 border border-zinc-200/80">
            <button
              type="button"
              onClick={() => setViewMode("settimana")}
              className={`px-1.5 py-1 rounded-md text-[10px] font-black transition-all ${
                viewMode === "settimana"
                  ? "bg-white text-[#1c00ff] shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
              title="Vista Settimana"
            >
              Sett.
            </button>
            <button
              type="button"
              onClick={() => setViewMode("mese")}
              className={`px-1.5 py-1 rounded-md text-[10px] font-black transition-all ${
                viewMode === "mese"
                  ? "bg-white text-[#1c00ff] shadow-xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
              title="Vista Mese Intero"
            >
              Mese
            </button>
          </div>
        </div>
      </div>

      {/* ─── BARRA SALTI RAPIDI (+1 SETTIMANA, -1 SETTIMANA, GIORNO PREC/SUCC) ── */}
      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-zinc-100 text-xs flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleStepWeek(-1)}
            className="h-6 px-1.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 rounded"
          >
            -1 Sett.
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleStepWeek(1)}
            className="h-6 px-1.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 rounded"
          >
            +1 Sett.
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleStepWeek(2)}
            className="h-6 px-1.5 text-[10px] font-bold text-zinc-500 hover:text-zinc-900 rounded"
          >
            +2 Sett.
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleStepDay(-1)}
            className="h-6 px-2 text-[10px] font-bold rounded-lg border-zinc-200 text-zinc-700 hover:bg-zinc-50 flex items-center gap-0.5"
          >
            <ChevronLeft className="size-3" /> Giorno
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleStepDay(1)}
            className="h-6 px-2 text-[10px] font-bold rounded-lg border-zinc-200 text-zinc-700 hover:bg-zinc-50 flex items-center gap-0.5"
          >
            Giorno <ChevronRight className="size-3" />
          </Button>
        </div>
      </div>

      {/* ─── VISTA 1: GRIGLIA MENSILE (7 COLONNE LUN-DOM) ────────────────────── */}
      {viewMode === "mese" && (
        <div className="space-y-1 pt-1">
          {/* INTESTAZIONE GIORNI (Lun, Mar...) */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {GIORNI_SETTIMANA_ABBR.map((g, idx) => (
              <div
                key={g}
                className={`text-[10px] font-black uppercase py-0.5 ${
                  idx >= 5 ? "text-zinc-400" : "text-zinc-500"
                }`}
              >
                {g}
              </div>
            ))}
          </div>

          {/* CELLE GIORNI MESE */}
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((cell) => {
              const isSelected = cell.dateStr === selectedDate;
              const status = getDateStatus(cell.dateStr);

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => onSelectDate(cell.dateStr)}
                  className={`min-h-[42px] sm:min-h-[46px] p-1 rounded-2xl flex flex-col items-center justify-between transition-all relative border cursor-pointer ${
                    isSelected
                      ? "bg-[#1c00ff] text-white border-[#1c00ff] shadow-sm ring-2 ring-[#1c00ff]/30 font-black z-10"
                      : cell.isCurrentMonth
                      ? cell.isToday
                        ? "bg-amber-50/60 border-amber-300 text-zinc-900 font-bold"
                        : "bg-zinc-50/70 hover:bg-zinc-100 border-zinc-200/80 text-zinc-800 font-bold"
                      : "bg-zinc-100/30 border-transparent text-zinc-400 font-normal hover:bg-zinc-100/60"
                  } ${status.isChiuso && !isSelected ? "bg-red-50/60 border-red-200 text-red-900" : ""}`}
                >
                  {/* NUMERO DEL GIORNO */}
                  <div className="flex items-center gap-0.5 leading-none">
                    <span className="text-xs tabular-nums">{cell.dayNum}</span>
                    {cell.isToday && !isSelected && (
                      <span className="size-1.5 rounded-full bg-[#1c00ff]" title="Oggi" />
                    )}
                  </div>

                  {/* BADGES / PUNTINI DI STATO */}
                  <div className="flex items-center justify-center gap-1 w-full mt-0.5">
                    {/* CHIUSO PER FERIE */}
                    {status.isChiuso ? (
                      <span
                        className={`text-[8px] font-black uppercase px-1 py-0.2 rounded-full leading-tight ${
                          isSelected
                            ? "bg-red-500 text-white"
                            : "bg-red-100 text-red-700 border border-red-300"
                        }`}
                      >
                        Chiuso
                      </span>
                    ) : isManager ? (
                      /* MANAGER: MOSTRA NUMERO SEDUTE */
                      status.count > 0 ? (
                        <span
                          className={`text-[9px] font-black tabular-nums px-1.5 py-0.2 rounded-full leading-tight ${
                            isSelected
                              ? "bg-[#e3ff00] text-zinc-950"
                              : "bg-[#1c00ff]/10 text-[#1c00ff] border border-[#1c00ff]/20"
                          }`}
                        >
                          {status.count}
                        </span>
                      ) : (
                        <span
                          className={`size-1.5 rounded-full ${
                            isSelected ? "bg-white/40" : "bg-zinc-200"
                          }`}
                        />
                      )
                    ) : (
                      /* ATLETA: STATUS PRENOTAZIONE O DISPONIBILITÀ */
                      <>
                        {status.haMiaPrenotazione ? (
                          <span
                            className={`size-2 rounded-full flex items-center justify-center ${
                              isSelected ? "bg-[#e3ff00]" : "bg-[#1c00ff]"
                            }`}
                            title="Hai una seduta prenotata"
                          />
                        ) : status.hasSlotsLiberi && !cell.isPast ? (
                          <span
                            className={`size-1.5 rounded-full ${
                              isSelected ? "bg-emerald-300" : "bg-emerald-500"
                            }`}
                            title="Slot liberi disponibili"
                          />
                        ) : (
                          <span
                            className={`size-1 rounded-full ${
                              isSelected ? "bg-white/30" : "bg-zinc-200"
                            }`}
                          />
                        )}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── VISTA 2: STRISCIA SETTIMANALE (7 GIORNI ORIZZONTALI) ─────────────── */}
      {viewMode === "settimana" && (
        <div className="pt-1">
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((g) => {
              const isSelected = g.dateStr === selectedDate;
              const status = getDateStatus(g.dateStr);

              return (
                <button
                  key={g.dateStr}
                  type="button"
                  onClick={() => onSelectDate(g.dateStr)}
                  className={`py-2 px-1 rounded-2xl flex flex-col items-center justify-between transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-[#1c00ff] text-white border-[#1c00ff] shadow-sm ring-2 ring-[#1c00ff]/30 font-black"
                      : g.isToday
                      ? "bg-amber-50 border-amber-300 text-zinc-900 font-bold"
                      : "bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700 font-bold"
                  } ${status.isChiuso && !isSelected ? "bg-red-50 border-red-200 text-red-900" : ""}`}
                >
                  <span className="text-[10px] uppercase font-black">{g.dayName}</span>
                  <span className="text-sm tabular-nums mt-0.5">{g.dayNum}</span>

                  <div className="flex items-center justify-center gap-1 mt-1">
                    {status.isChiuso ? (
                      <span className="size-1.5 rounded-full bg-red-500" />
                    ) : isManager ? (
                      status.count > 0 ? (
                        <span
                          className={`text-[8px] font-black px-1 rounded-full ${
                            isSelected ? "bg-[#e3ff00] text-zinc-950" : "bg-zinc-200 text-zinc-700"
                          }`}
                        >
                          {status.count}
                        </span>
                      ) : null
                    ) : status.haMiaPrenotazione ? (
                      <span
                        className={`size-1.5 rounded-full ${
                          isSelected ? "bg-[#e3ff00]" : "bg-[#1c00ff]"
                        }`}
                      />
                    ) : status.hasSlotsLiberi && !g.isPast ? (
                      <span
                        className={`size-1.5 rounded-full ${
                          isSelected ? "bg-emerald-300" : "bg-emerald-500"
                        }`}
                      />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── BARRA RIEPILOGO DATA SELEZIONATA ─────────────────────────────────── */}
      <div className="p-2.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-center justify-between text-xs flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-[#1c00ff] animate-pulse shrink-0" />
          <div>
            <span className="text-zinc-500 text-[10px] uppercase font-black block leading-none">
              Giorno Selezionato:
            </span>
            <span className="font-black text-zinc-900 capitalize text-xs">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Badge veloce stato giorno */}
        {(() => {
          const st = getDateStatus(selectedDate);
          if (st.isChiuso) {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-200">
                Chiuso per Ferie
              </span>
            );
          }
          if (isManager) {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#1c00ff]/10 text-[#1c00ff] border border-[#1c00ff]/20">
                {st.count} {st.count === 1 ? "Seduta Pianificata" : "Sedute Pianificate"}
              </span>
            );
          }
          if (st.haMiaPrenotazione) {
            return (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Seduta Fissata
              </span>
            );
          }
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 text-zinc-700">
              {st.hasSlotsLiberi ? "Slot Disponibili" : "Tutto Occupato"}
            </span>
          );
        })()}
      </div>
    </div>
  );
}
