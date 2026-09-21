import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  nome: string;
  cognome: string;
  telefono?: string;
  codice_fiscale?: string;
  indirizzo?: string;
  ruolo: "manager" | "atleta";
  crediti: number;
  tempo_cancellazione_ore?: number; // 12, 24, 36, 48
  data_scadenza_crediti?: string;
  data_ultimo_accesso?: string;
  note_coach?: string;
  giorni_a_scadenza?: number | null;
  avviso_scadenza?: boolean;
  mesi_inattivita?: number;
  avviso_inattivita?: boolean;
}

export interface MovimentoCrediti {
  id: string;
  atleta_id: string;
  email_cliente: string;
  nome_cliente: string;
  data_ora: string;
  tipo:
    | "acquisto_carnet"
    | "prenotazione_slot"
    | "rimborso_cancellazione"
    | "bonus_regalo"
    | "penalty"
    | "regolazione_debito"
    | "modifica_manuale";
  delta_crediti: number;
  saldo_risultante: number;
  motivazione: string;
  operatore: "atleta" | "coach" | "sistema";
}

export interface EccezioneCalendario {
  id: string;
  data: string; // YYYY-MM-DD
  orario?: string | null; // HH:mm
  tipo: "slot_straordinario" | "slot_bloccato" | "chiusura_giornata";
  motivo?: string;
  created_at: string;
}

export interface LabConfig {
  tempo_cancellazione_ore: number; // 12, 24, 36, 48
  iban: string;
  intestatario_iban: string;
  banca: string;
  notifica_email: string;
  notifica_whatsapp: string;
  orari_disponibili: string[];
  giorni_aperti: number[];
  inattivita_mesi_reset: number;
}

export function useCurrentUser() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, refetch } = useQuery<UserProfile>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const res = await fetch("/app-api/auth/current-user");
      if (!res.ok) throw new Error("Errore recupero utente");
      return res.json();
    },
    staleTime: 1000 * 30, // 30 sec
  });

  const isManager = user?.ruolo === "manager";
  const isAtleta = user?.ruolo === "atleta";
  const crediti = user?.crediti ?? 0;
  const hasDebt = crediti < 0;
  const isZeroCredits = crediti <= 0;

  // Calcolo scadenza
  const todayStr = new Date().toISOString().slice(0, 10);
  const isExpired = user?.data_scadenza_crediti ? user.data_scadenza_crediti < todayStr : false;

  // Switch utente
  const switchMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/app-api/auth/switch-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Errore durante il cambio utente");
      return res.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["current-user"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      queryClient.invalidateQueries({ queryKey: ["stati"] });
      queryClient.invalidateQueries({ queryKey: ["preferenze"] });
      toast.success(
        `Sessione attiva: ${updatedUser.name} (${updatedUser.ruolo === "manager" ? "Coach / Manager" : "Atleta"})`
      );
    },
    onError: () => {
      toast.error("Impossibile cambiare profilo utente.");
    },
  });

  const switchUser = useCallback(
    (userId: string) => switchMutation.mutate(userId),
    [switchMutation]
  );

  return {
    user,
    isLoading,
    isManager,
    isAtleta,
    crediti,
    hasDebt,
    isZeroCredits,
    isExpired,
    switchUser,
    isSwitching: switchMutation.isPending,
    refetch,
  };
}

export function useProfili() {
  const queryClient = useQueryClient();

  const { data: profili = [], isLoading, refetch } = useQuery<UserProfile[]>({
    queryKey: ["profili"],
    queryFn: async () => {
      const res = await fetch("/app-api/profili");
      if (!res.ok) throw new Error("Errore recupero profili");
      return res.json();
    },
  });

  const modificaCrediti = useMutation({
    mutationFn: async ({
      id,
      crediti,
      delta,
      tipo,
      motivazione,
      data_scadenza_crediti,
    }: {
      id: string;
      crediti?: number;
      delta?: number;
      tipo?: string;
      motivazione?: string;
      data_scadenza_crediti?: string;
    }) => {
      const res = await fetch(`/app-api/profili/${id}/modifica-crediti`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crediti, delta, tipo, motivazione, data_scadenza_crediti }),
      });
      if (!res.ok) throw new Error("Errore modifica crediti");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      toast.success("Crediti / Scadenza aggiornati con successo!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore aggiornamento crediti");
    },
  });

  const salvaProfilo = useMutation({
    mutationFn: async (profilo: Partial<UserProfile> & { id?: string }) => {
      const isNew = !profilo.id;
      const url = isNew ? "/app-api/profili" : `/app-api/profili/${profilo.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilo),
      });
      if (!res.ok) throw new Error("Errore salvataggio profilo");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Profilo salvato correttamente!");
    },
  });

  return {
    profili,
    isLoading,
    refetch,
    modificaCrediti: modificaCrediti.mutateAsync,
    salvaProfilo: salvaProfilo.mutateAsync,
  };
}

export function useMovimentiCrediti(atletaId?: string, email?: string) {
  const queryClient = useQueryClient();

  const { data: movimenti = [], isLoading, refetch } = useQuery<MovimentoCrediti[]>({
    queryKey: ["movimenti-crediti", atletaId, email],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (atletaId) params.set("atleta_id", atletaId);
      if (email) params.set("email", email);
      const res = await fetch(`/app-api/movimenti-crediti?${params.toString()}`);
      if (!res.ok) throw new Error("Errore recupero movimenti crediti");
      return res.json();
    },
  });

  const registraMovimento = useMutation({
    mutationFn: async ({
      atleta_id,
      tipo,
      delta_crediti,
      motivazione,
    }: {
      atleta_id: string;
      tipo: "bonus_regalo" | "penalty" | "modifica_manuale";
      delta_crediti: number;
      motivazione: string;
    }) => {
      const res = await fetch("/app-api/movimenti-crediti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atleta_id, tipo, delta_crediti, motivazione }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore salvataggio movimento");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      toast.success("Movimento crediti registrato nel ledger!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore nella registrazione");
    },
  });

  return {
    movimenti,
    isLoading,
    refetch,
    registraMovimento: registraMovimento.mutateAsync,
  };
}

export function useEccezioniCalendario(data?: string) {
  const queryClient = useQueryClient();

  const { data: eccezioni = [], isLoading, refetch } = useQuery<EccezioneCalendario[]>({
    queryKey: ["eccezioni-calendario", data],
    queryFn: async () => {
      const url = data ? `/app-api/eccezioni-calendario?data=${data}` : "/app-api/eccezioni-calendario";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Errore recupero eccezioni calendario");
      return res.json();
    },
  });

  const aggiungiEccezione = useMutation({
    mutationFn: async (payload: {
      data: string;
      orario?: string;
      orari?: string[];
      tipo: "slot_straordinario" | "slot_bloccato" | "chiusura_giornata";
      motivo?: string;
    }) => {
      const res = await fetch("/app-api/eccezioni-calendario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Errore salvataggio eccezione calendario");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eccezioni-calendario"] });
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      toast.success("Orario / Chiusura aggiornata nel calendario!");
    },
  });

  const rimuoviEccezione = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/app-api/eccezioni-calendario/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Errore rimozione eccezione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eccezioni-calendario"] });
      toast.success("Eccezione rimossa.");
    },
  });

  return {
    eccezioni,
    isLoading,
    refetch,
    aggiungiEccezione: aggiungiEccezione.mutateAsync,
    rimuoviEccezione: rimuoviEccezione.mutateAsync,
  };
}

export function useLabConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery<LabConfig>({
    queryKey: ["lab-config"],
    queryFn: async () => {
      const res = await fetch("/app-api/lab-config");
      if (!res.ok) throw new Error("Errore recupero configurazione lab");
      return res.json();
    },
  });

  const aggiornaConfig = useMutation({
    mutationFn: async (nuovaConfig: Partial<LabConfig>) => {
      const res = await fetch("/app-api/lab-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuovaConfig),
      });
      if (!res.ok) throw new Error("Errore aggiornamento config");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-config"] });
      toast.success("Configurazione Lab aggiornata!");
    },
    onError: () => {
      toast.error("Errore aggiornamento configurazione Lab.");
    },
  });

  return {
    config: config || {
      tempo_cancellazione_ore: 24,
      iban: "IT46X0306909606100000046460",
      intestatario_iban: "Area46 Training Lab SSD a r.l.",
      banca: "Banca Sella",
      notifica_email: "coach@area46.it",
      notifica_whatsapp: "+39 340 0000000",
      orari_disponibili: [
        "07:30", "08:30", "09:30", "10:30", "11:30",
        "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
      ],
      giorni_aperti: [1, 2, 3, 4, 5, 6],
      inattivita_mesi_reset: 6,
    },
    isLoading,
    aggiornaConfig: aggiornaConfig.mutateAsync,
  };
}
