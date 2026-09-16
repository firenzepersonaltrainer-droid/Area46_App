import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useProfili, UserProfile } from "../lib/useUser";
import {
  Users,
  Search,
  Plus,
  Coins,
  Calendar,
  AlertTriangle,
  Phone,
  Mail,
  Edit2,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/Dialog";
import { toast } from "sonner";

export default function ManagerAtletiPage() {
  const { profili, modificaCrediti, salvaProfilo } = useProfili();

  const [search, setSearch] = useState("");
  const [selectedAtleta, setSelectedAtleta] = useState<UserProfile | null>(null);

  // Modale Modifica Crediti / Debiti
  const [creditiModalOpen, setCreditiModalOpen] = useState(false);
  const [nuoviCrediti, setNuoviCrediti] = useState<number>(0);
  const [nuovaScadenza, setNuovaScadenza] = useState<string>("");

  // Modale Anagrafica / Nuovo Atleta
  const [anagraficaModalOpen, setAnagraficaModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  const atleti = profili.filter((p) => p.ruolo === "atleta");

  const filteredAtleti = atleti.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.nome.toLowerCase().includes(q) ||
      a.cognome.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.telefono && a.telefono.includes(q))
    );
  });

  const handleOpenCrediti = (atleta: UserProfile) => {
    setSelectedAtleta(atleta);
    setNuoviCrediti(atleta.crediti);
    setNuovaScadenza(atleta.data_scadenza_crediti || "");
    setCreditiModalOpen(true);
  };

  const handleSaveCrediti = async () => {
    if (!selectedAtleta) return;
    try {
      await modificaCrediti({
        id: selectedAtleta.id,
        crediti: Number(nuoviCrediti),
        data_scadenza_crediti: nuovaScadenza || undefined,
      });
      setCreditiModalOpen(false);
    } catch {
      // toast già gestito da hook
    }
  };

  const handleOpenEdit = (atleta?: UserProfile) => {
    if (atleta) {
      setEditForm(atleta);
    } else {
      setEditForm({
        nome: "",
        cognome: "",
        email: "",
        telefono: "",
        codice_fiscale: "",
        indirizzo: "",
        crediti: 10,
        data_scadenza_crediti: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      });
    }
    setAnagraficaModalOpen(true);
  };

  const handleSaveAnagrafica = async () => {
    if (!editForm.nome || !editForm.cognome) {
      toast.error("Nome e Cognome sono obbligatori");
      return;
    }
    try {
      await salvaProfilo(editForm);
      setAnagraficaModalOpen(false);
    } catch {
      // toast già gestito da hook
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* HEADER GESTIONE ATLETI */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#09090b] text-[#e3ff00] border border-[#e3ff00]/40">
              Pannello Manager
            </span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-zinc-900 mt-1 flex items-center gap-2">
            <Users className="size-5 text-[#1c00ff]" />
            Atleti & Crediti Lab
          </h1>
        </div>

        <Button
          onClick={() => handleOpenEdit()}
          className="rounded-xl text-xs font-black bg-[#1c00ff] text-white hover:bg-[#1600cc] flex items-center gap-1 h-9 px-3"
        >
          <Plus className="size-4" /> Nuovo Atleta
        </Button>
      </div>

      {/* BARRA DI RICERCA */}
      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder="Cerca atleta per nome, cognome, email o tel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white text-xs h-10 rounded-2xl border-zinc-200"
        />
      </div>

      {/* LISTA SCHEDE ATLETI */}
      <div className="space-y-3">
        {filteredAtleti.map((atleta) => {
          const hasDebt = atleta.crediti < 0;
          const isZero = atleta.crediti === 0;

          return (
            <div
              key={atleta.id}
              className="p-4 rounded-3xl bg-white border border-zinc-200 shadow-2xs space-y-3"
            >
              {/* RIGA 1: NOME & SALDO CREDITI */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-zinc-100 text-zinc-800 flex items-center justify-center font-black text-sm border border-zinc-200">
                    {atleta.nome[0]}
                    {atleta.cognome[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-zinc-900 leading-tight">
                      {atleta.nome} {atleta.cognome}
                    </h3>
                    <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {atleta.email}
                      </span>
                    </div>
                  </div>
                </div>

                {/* BADGE SALDO CREDITI */}
                <div className="text-right">
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border ${
                      hasDebt
                        ? "bg-red-50 text-red-700 border-red-200"
                        : isZero
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-emerald-50 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    <Coins className="size-3.5" />
                    <span>
                      {hasDebt ? `${atleta.crediti} DEBITO` : `${atleta.crediti} Crediti`}
                    </span>
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400 mt-0.5">
                    {atleta.data_scadenza_crediti
                      ? `Scad: ${new Date(atleta.data_scadenza_crediti).toLocaleDateString("it-IT", {
                          day: "numeric",
                          month: "short",
                        })}`
                      : "Senza scadenza"}
                  </div>
                </div>
              </div>

              {/* RIGA 2: ALERT SCADENZA / INATTIVITÀ 6 MESI */}
              {atleta.avviso_scadenza && (
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                  <span>Crediti in scadenza entro {atleta.giorni_a_scadenza} giorni.</span>
                </div>
              )}

              {atleta.avviso_inattivita && (
                <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-bold flex items-center gap-1.5">
                  <Clock className="size-3.5 text-purple-600 shrink-0" />
                  <span>
                    Inattivo da <strong>{atleta.mesi_inattivita} mesi</strong>. Regola 6 mesi:
                    inviare notifica prima del reset dello storico.
                  </span>
                </div>
              )}

              {/* RIGA 3: DETTAGLI & AZIONI */}
              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                <div className="text-[11px] text-zinc-500">
                  {atleta.telefono ? (
                    <a
                      href={`tel:${atleta.telefono}`}
                      className="text-zinc-700 font-semibold hover:text-[#1c00ff] flex items-center gap-1"
                    >
                      <Phone className="size-3" /> {atleta.telefono}
                    </a>
                  ) : (
                    <span>Nessun recapito telefonico</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenCrediti(atleta)}
                    className="text-xs font-bold h-8 px-2.5 rounded-xl border-zinc-300"
                  >
                    Crediti / Debiti
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(atleta)}
                    className="text-xs text-zinc-600 h-8 w-8 p-0 rounded-xl"
                    aria-label="Modifica anagrafica"
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALE GESTIONE CREDITI & DEBITI */}
      <Dialog open={creditiModalOpen} onOpenChange={setCreditiModalOpen}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Coins className="size-5 text-[#1c00ff]" />
              Modifica Crediti & Debiti
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Aggiorna il saldo e la scadenza di {selectedAtleta?.nome} {selectedAtleta?.cognome}.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-4 text-xs">
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600 block mb-1">
                Saldo Crediti (accetta anche valori negativi per debiti, es. -2)
              </label>
              <Input
                type="number"
                value={nuoviCrediti}
                onChange={(e) => setNuoviCrediti(Number(e.target.value))}
                className="text-base font-black tabular-nums"
              />
              <div className="flex gap-1.5 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNuoviCrediti((prev) => prev - 1)}
                  className="flex-1 text-xs h-7"
                >
                  -1 Seduta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNuoviCrediti((prev) => prev + 1)}
                  className="flex-1 text-xs h-7 text-emerald-700"
                >
                  +1 Seduta
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNuoviCrediti((prev) => prev + 10)}
                  className="flex-1 text-xs h-7 font-bold text-[#1c00ff]"
                >
                  +10 Pack
                </Button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600 block mb-1">
                Data di Scadenza Crediti
              </label>
              <Input
                type="date"
                value={nuovaScadenza}
                onChange={(e) => setNuovaScadenza(e.target.value)}
                className="text-xs"
              />
              <div className="flex gap-1.5 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 30);
                    setNuovaScadenza(d.toISOString().slice(0, 10));
                  }}
                  className="flex-1 text-[11px] h-7"
                >
                  +30 Giorni
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 60);
                    setNuovaScadenza(d.toISOString().slice(0, 10));
                  }}
                  className="flex-1 text-[11px] h-7"
                >
                  +60 Giorni
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCreditiModalOpen(false)}
              className="flex-1 rounded-xl"
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveCrediti}
              className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black"
            >
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODALE ANAGRAFICA ATLETA */}
      <Dialog open={anagraficaModalOpen} onOpenChange={setAnagraficaModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-zinc-900 flex items-center gap-2">
              <Users className="size-5 text-[#1c00ff]" />
              {editForm.id ? "Modifica Anagrafica Atleta" : "Registra Nuovo Atleta"}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Dati anagrafici e recapiti per notifiche e ricevute Lab.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                  Nome
                </label>
                <Input
                  value={editForm.nome || ""}
                  onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                  placeholder="Nome"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                  Cognome
                </label>
                <Input
                  value={editForm.cognome || ""}
                  onChange={(e) => setEditForm({ ...editForm, cognome: e.target.value })}
                  placeholder="Cognome"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Email
              </label>
              <Input
                type="email"
                value={editForm.email || ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="atleta@example.com"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                Telefono (WhatsApp)
              </label>
              <Input
                value={editForm.telefono || ""}
                onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                placeholder="+39 333 1234567"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                  Codice Fiscale
                </label>
                <Input
                  value={editForm.codice_fiscale || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, codice_fiscale: e.target.value.toUpperCase() })
                  }
                  placeholder="Codice Fiscale"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">
                  Crediti Iniziali
                </label>
                <Input
                  type="number"
                  value={editForm.crediti ?? 0}
                  onChange={(e) => setEditForm({ ...editForm, crediti: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setAnagraficaModalOpen(false)}
              className="flex-1 rounded-xl"
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveAnagrafica}
              className="flex-1 rounded-xl bg-[#1c00ff] text-white hover:bg-[#1600cc] font-black"
            >
              Salva Atleta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
