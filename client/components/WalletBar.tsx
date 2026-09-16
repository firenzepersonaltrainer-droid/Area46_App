import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "../lib/useUser";
import { RoleSwitcherModal } from "./RoleSwitcherModal";
import {
  Coins,
  AlertTriangle,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  RefreshCw,
} from "lucide-react";

export function WalletBar() {
  const { user, isManager, isAtleta, crediti, hasDebt, isZeroCredits, isExpired } =
    useCurrentUser();
  const [showSwitcher, setShowSwitcher] = useState(false);

  if (!user) return null;

  return (
    <>
      <div className="w-full bg-white border-b border-zinc-200 shadow-2xs px-3.5 py-2.5">
        {/* RIGA PRINCIPALE: RUOLO / NOME UTENTE + CREDITI */}
        <div className="flex items-center justify-between gap-2">
          {/* IDENTITÀ UTENTE & SWITCHER */}
          <button
            type="button"
            onClick={() => setShowSwitcher(true)}
            className="flex items-center gap-2 group text-left cursor-pointer hover:opacity-85 transition-opacity"
            title="Clicca per cambiare profilo o accedere come Coach"
          >
            <div
              className={`size-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                isManager
                  ? "bg-[#09090b] text-[#e3ff00] border border-[#e3ff00]/40"
                  : "bg-[#1c00ff]/10 text-[#1c00ff] border border-[#1c00ff]/20"
              }`}
            >
              {isManager ? (
                <ShieldCheck className="size-4 text-[#e3ff00]" />
              ) : (
                <UserCheck className="size-4 text-[#1c00ff]" />
              )}
            </div>

            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-black tracking-tight text-zinc-900">
                  {user.name || `${user.nome} ${user.cognome}`}
                </span>
                <span className="text-[9px] font-bold text-zinc-400 group-hover:text-[#1c00ff] flex items-center gap-0.5 underline decoration-dotted">
                  <RefreshCw className="size-2.5" /> Cambia
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-semibold mt-0.5">
                {isManager ? "Pannello Gestore Lab" : user.email}
              </span>
            </div>
          </button>

          {/* WALLET CREDITI (ATLETA) O SHORTCUT (COACH) */}
          <div className="flex items-center gap-2">
            {isAtleta && (
              <>
                {/* PILLOLA CREDITI / DEBITO */}
                <div
                  className={`flex flex-col items-end justify-center px-2.5 py-1 rounded-xl border leading-tight ${
                    hasDebt
                      ? "bg-red-50 border-red-200 text-red-700"
                      : isZeroCredits || isExpired
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Coins className="size-3.5" />
                    <span className="text-[13px] font-black tabular-nums">
                      {hasDebt
                        ? `${crediti} DEBITO`
                        : `${crediti} ${crediti === 1 ? "Credito" : "Crediti"}`}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-zinc-500">
                    {user.data_scadenza_crediti
                      ? `Scad: ${new Date(user.data_scadenza_crediti).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "short",
                        })}`
                      : "Senza scadenza"}
                  </span>
                </div>

                {/* PULSANTE RICARICA */}
                <Link
                  to="/tariffario"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-[#e3ff00] text-zinc-950 border border-zinc-900 shadow-xs hover:bg-[#d9f200] transition-colors flex items-center gap-1 shrink-0"
                >
                  <Sparkles className="size-3 text-[#1c00ff]" />
                  <span>Ricarica</span>
                </Link>
              </>
            )}

            {isManager && (
              <div className="flex items-center gap-1.5">
                <Link
                  to="/manager/calendario"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-[#1c00ff] text-white hover:bg-[#1600cc] transition-colors flex items-center gap-1"
                >
                  <Calendar className="size-3.5" />
                  <span>Calendario</span>
                </Link>
                <Link
                  to="/manager/atleti"
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-800 hover:bg-zinc-200 transition-colors"
                >
                  Atleti
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* NOTIFICHE E ALERT WALLET ATLETA */}
        {isAtleta && (
          <div className="mt-2">
            {hasDebt && (
              <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-red-600 shrink-0" />
                  <span>
                    Hai <strong>{Math.abs(crediti)} sedute a debito</strong>. Verranno detratte
                    automaticamente alla prossima ricarica carnet.
                  </span>
                </div>
                <Link
                  to="/tariffario"
                  className="text-red-900 font-bold underline shrink-0 flex items-center gap-0.5"
                >
                  Sana debito <ArrowRight className="size-3" />
                </Link>
              </div>
            )}

            {!hasDebt && isZeroCredits && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                  <span>
                    Crediti esauriti. Gli slot di allenamento 1:1 sono temporaneamente bloccati.
                  </span>
                </div>
                <Link
                  to="/tariffario"
                  className="text-amber-950 font-bold underline shrink-0 flex items-center gap-0.5"
                >
                  Ricarica <ArrowRight className="size-3" />
                </Link>
              </div>
            )}

            {!hasDebt && !isZeroCredits && user.avviso_scadenza && (
              <div className="p-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-semibold flex items-center justify-between gap-2">
                <span>
                  ⏰ I tuoi crediti scadono tra <strong>{user.giorni_a_scadenza} giorni</strong>!
                  Prenota i tuoi slot per non perdere le sedute.
                </span>
                <Link to="/prenota" className="font-bold underline shrink-0">
                  Prenota ora
                </Link>
              </div>
            )}

            {!hasDebt && crediti === 1 && !user.avviso_scadenza && (
              <div className="p-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[10px] font-semibold flex items-center justify-between gap-2">
                <span>
                  ⚡ Ti rimane solo <strong>1 credito</strong>. Ricarica per mantenere i tuoi slot
                  fissi garantiti.
                </span>
                <Link to="/tariffario" className="font-bold underline shrink-0">
                  Rinnova
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <RoleSwitcherModal open={showSwitcher} onOpenChange={setShowSwitcher} />
    </>
  );
}
