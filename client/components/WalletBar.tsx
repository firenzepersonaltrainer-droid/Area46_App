import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../lib/useUser";
import {
  Coins,
  AlertTriangle,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  LogOut,
} from "lucide-react";

export function WalletBar() {
  const navigate = useNavigate();
  const { user, isManager, isAtleta, crediti, hasDebt, isZeroCredits, isExpired, switchUser } =
    useCurrentUser();

  if (!user) return null;

  return (
    <div className="w-full bg-white border-b border-zinc-200 shadow-2xs px-3.5 py-2.5">
      {/* RIGA PRINCIPALE */}
      <div className="flex items-center justify-between gap-2">
        {/* IDENTITÀ UTENTE */}
        <div className="flex items-center gap-2">
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
            <span className="text-[13px] font-black tracking-tight text-zinc-900">
              {user.name || `${user.nome} ${user.cognome}`}
            </span>
            <span className="text-[10px] text-zinc-500 font-semibold mt-0.5">
              {isManager ? "Pannello Gestore Lab" : user.email}
            </span>
          </div>
        </div>

        {/* WALLET ATLETA O COMANDI COACH */}
        <div className="flex items-center gap-2">
          {isAtleta && (
            <>
              {/* PILLOLA CREDITI / DEBITO */}
              <Link
                to="/account"
                className={`flex flex-col items-end justify-center px-2.5 py-1 rounded-xl border leading-tight transition-opacity hover:opacity-90 ${
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
              </Link>

              {/* PULSANTE AREA PERSONALE / RICARICA */}
              <Link
                to="/account"
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

              {/* Tasto per uscire da modalità Coach e tornare ad Atleta */}
              <button
                type="button"
                onClick={() => {
                  switchUser("usr-atleta-01");
                  navigate("/");
                }}
                className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors cursor-pointer"
                title="Torna a vista Atleta"
              >
                <LogOut className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* NOTIFICHE ATLETA */}
      {isAtleta && (
        <div className="mt-2">
          {hasDebt && (
            <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-red-600 shrink-0" />
                <span>
                  Hai <strong>{Math.abs(crediti)} sedute a debito</strong>. Verranno sanate al prossimo pacchetto lab.
                </span>
              </div>
              <Link
                to="/account"
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
                <span>Crediti esauriti. Le prenotazioni degli slot sono temporaneamente bloccate.</span>
              </div>
              <Link
                to="/account"
                className="text-amber-950 font-bold underline shrink-0 flex items-center gap-0.5"
              >
                Ricarica <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
