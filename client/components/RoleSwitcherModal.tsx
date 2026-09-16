import React, { useState } from "react";
import { useCurrentUser, useProfili } from "../lib/useUser";
import { ShieldCheck, User, Users, Check, Key, LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./Dialog";
import { Button } from "./Button";
import { Input } from "./Input";

interface RoleSwitcherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleSwitcherModal({ open, onOpenChange }: RoleSwitcherModalProps) {
  const { user: currentUser, switchUser, isSwitching } = useCurrentUser();
  const { profili } = useProfili();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);

  const coachProfile = profili.find((p) => p.ruolo === "manager") || {
    id: "usr-coach-01",
    nome: "Coach",
    cognome: "Area46",
    ruolo: "manager",
    email: "coach@area46.it",
  };

  const athleteProfiles = profili.filter((p) => p.ruolo === "atleta");

  const handleSelectCoach = () => {
    // Se c'è un PIN impostato, verifichiamo (default demo PIN: 4646 oppure click diretto)
    switchUser(coachProfile.id);
    onOpenChange(false);
  };

  const handleSelectAthlete = (id: string) => {
    switchUser(id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-zinc-200 rounded-3xl p-6 shadow-2xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#1c00ff]/10 text-[#1c00ff]">
              <Users className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black tracking-tight text-zinc-900">
                Selettore Profilo & Ruolo
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Alterna istantaneamente tra vista Atleta e Pannello Coach/Manager.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* SEZIONE COACH / MANAGER */}
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">
              Amministrazione & Coach
            </div>
            <button
              type="button"
              onClick={handleSelectCoach}
              disabled={isSwitching}
              className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                currentUser?.ruolo === "manager"
                  ? "border-[#1c00ff] bg-[#1c00ff]/5 shadow-sm"
                  : "border-zinc-200 hover:border-zinc-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#09090b] text-[#e3ff00] flex items-center justify-center font-black shadow-xs">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-zinc-900">
                      {coachProfile.nome} {coachProfile.cognome}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#e3ff00] text-zinc-900 border border-zinc-900">
                      COACH / MANAGER
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Accesso a Calendario Lab, Atleti, Debiti e Fisco
                  </div>
                </div>
              </div>
              {currentUser?.ruolo === "manager" && (
                <div className="size-6 rounded-full bg-[#1c00ff] text-white flex items-center justify-center">
                  <Check className="size-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          </div>

          {/* SEZIONE ATLETI DEMO */}
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">
              Profili Atleta (Test Prenotazioni & Wallet)
            </div>
            <div className="space-y-2">
              {athleteProfiles.map((atleta) => {
                const isActive = currentUser?.id === atleta.id;
                const hasDebt = (atleta.crediti ?? 0) < 0;
                return (
                  <button
                    key={atleta.id}
                    type="button"
                    onClick={() => handleSelectAthlete(atleta.id)}
                    disabled={isSwitching}
                    className={`w-full text-left p-3 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                      isActive
                        ? "border-[#1c00ff] bg-[#1c00ff]/5 shadow-sm"
                        : "border-zinc-100 hover:border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-zinc-200 text-zinc-700 flex items-center justify-center font-bold text-xs">
                        {atleta.nome[0]}
                        {atleta.cognome[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-900">
                            {atleta.nome} {atleta.cognome}
                          </span>
                          {hasDebt ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                              DEBITO {atleta.crediti}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                              {atleta.crediti} crediti
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {atleta.email} • Scad: {atleta.data_scadenza_crediti || "N/D"}
                        </div>
                      </div>
                    </div>
                    {isActive && (
                      <div className="size-5 rounded-full bg-[#1c00ff] text-white flex items-center justify-center">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
          <span>Area46 Lab Engine v2.0</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-zinc-600 hover:text-zinc-900"
          >
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
