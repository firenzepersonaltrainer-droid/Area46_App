import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  AttivitaLab,
  RegolaPalinsesto,
  ATTIVITA_DEFAULT_LANDMINE,
  REGOLA_DEFAULT_LANDMINE,
} from "./palinsesto";
export type { AttivitaLab, RegolaPalinsesto };

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
  tempo_anticipo_prenotazione_ore?: number; // 0, 12, 24, 36, 48
  data_scadenza_crediti?: string;
  data_ultimo_accesso?: string;
  note_coach?: string;
  giorni_a_scadenza?: number | null;
  avviso_scadenza?: boolean;
  mesi_inattivita?: number;
  avviso_inattivita?: boolean;
  tipo_abbonamento?: "nessuno" | "lab_continuativo_2x" | "lab_continuativo_3x" | "standard";
  stato_iscrizione?: "attivo" | "dismesso" | "sospeso";
  data_inizio_abbonamento?: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
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
  tempo_anticipo_prenotazione_ore?: number; // 0, 12, 24, 36, 48
  iban: string;
  intestatario_iban: string;
  banca: string;
  notifica_email: string;
  notifica_whatsapp: string;
  orari_disponibili: string[];
  giorni_aperti: number[];
  inattivita_mesi_reset: number;
  stripe_mode?: "test" | "live";
  stripe_publishable_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  stripe_collegato?: boolean;
}

export function useCurrentUser() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, refetch } = useQuery<UserProfile>({
    queryKey: ["current-user"],
    queryFn: async () => {
      try {
        const res = await fetch("/app-api/auth/current-user");
        if (!res.ok) return null as any;
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("json")) {
          return null as any;
        }
        return await res.json();
      } catch {
        return null as any;
      }
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

  // Logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/app-api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Errore durante il logout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["current-user"], null);
      queryClient.invalidateQueries();
      toast.info("Sessione terminata. A presto!");
    },
    onError: () => {
      toast.error("Errore durante la disconnessione.");
    },
  });

  const logout = useCallback(() => logoutMutation.mutate(), [logoutMutation]);

  // Login Email / OTP
  const loginEmailMutation = useMutation({
    mutationFn: async ({
      email,
      code,
      requestOtpOnly,
    }: {
      email: string;
      code?: string;
      requestOtpOnly?: boolean;
    }) => {
      const res = await fetch("/app-api/auth/login-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, requestOtpOnly }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore durante l'accesso");
      return data;
    },
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(["current-user"], data.user);
        queryClient.invalidateQueries();
        toast.success(`Accesso completato: benvenuto ${data.user.nome || data.user.name}!`);
      }
    },
  });

  // Login Social (Google / Apple)
  const oauthLoginMutation = useMutation({
    mutationFn: async ({
      provider,
      email,
      name,
    }: {
      provider: "google" | "apple";
      email: string;
      name?: string;
    }) => {
      const res = await fetch("/app-api/auth/oauth-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, email, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore accesso social");
      return data;
    },
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(["current-user"], data.user);
        queryClient.invalidateQueries();
        toast.success(`Accesso ${data.user.ruolo === "manager" ? "Coach" : "Atleta"} completato!`);
      }
    },
  });

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
    logout,
    isLoggingOut: logoutMutation.isPending,
    loginEmailMutation,
    oauthLoginMutation,
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

  const dismettiAtleta = useMutation({
    mutationFn: async ({
      id,
      penale_euro,
      note,
      tariffa_seduta,
      sedute_svolte,
      totale_versato,
    }: {
      id: string;
      penale_euro: number;
      note?: string;
      tariffa_seduta?: number;
      sedute_svolte?: number;
      totale_versato?: number;
    }) => {
      const res = await fetch(`/app-api/atleti/${id}/dismissione-anticipata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ penale_euro, note, tariffa_seduta, sedute_svolte, totale_versato }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore durante la dismissione");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      queryClient.invalidateQueries({ queryKey: ["transazioni"] });
    },
  });

  const eliminaAtleta = useMutation({
    mutationFn: async (idOrEmail: string) => {
      const res = await fetch(`/app-api/atleti/${encodeURIComponent(idOrEmail)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore durante l'eliminazione dell'atleta");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profili"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
      queryClient.invalidateQueries({ queryKey: ["prenotazioni"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-crediti"] });
      queryClient.invalidateQueries({ queryKey: ["transazioni"] });
      queryClient.invalidateQueries({ queryKey: ["diario"] });
      queryClient.invalidateQueries({ queryKey: ["stati"] });
      toast.success("Atleta eliminato dall'anagrafica. I movimenti fiscali rimangono preservati.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore durante l'eliminazione");
    },
  });

  return {
    profili,
    isLoading,
    refetch,
    modificaCrediti: modificaCrediti.mutateAsync,
    salvaProfilo: salvaProfilo.mutateAsync,
    dismettiAtleta: dismettiAtleta.mutateAsync,
    eliminaAtleta: eliminaAtleta.mutateAsync,
    isDeleting: eliminaAtleta.isPending,
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

export const STRIPE_STORAGE_KEY = "area46_stripe_credentials_v1";

export interface StoredStripeCredentials {
  stripe_mode?: "test" | "live";
  stripe_publishable_key?: string;
  stripe_secret_key?: string;
  stripe_webhook_secret?: string;
  saved_at?: string;
}

export function getStoredStripeCredentials(): StoredStripeCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STRIPE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredStripeCredentials(creds: Partial<StoredStripeCredentials>) {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredStripeCredentials() || {};
    const updated: StoredStripeCredentials = {
      ...current,
      ...creds,
      saved_at: new Date().toISOString(),
    };
    localStorage.setItem(STRIPE_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently ignore storage quota or private mode errors
  }
}

export const DELETED_TX_STORAGE_KEY = "area46_deleted_tx_v1";

export function getDeletedTxIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_TX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDeletedTxId(idOrCode: string) {
  if (typeof window === "undefined" || !idOrCode) return;
  try {
    const current = getDeletedTxIds();
    if (!current.includes(idOrCode)) {
      current.push(idOrCode);
      localStorage.setItem(DELETED_TX_STORAGE_KEY, JSON.stringify(current));
    }
  } catch {
    // ignore
  }
}

export function isTxDeleted(idOrCode?: string): boolean {
  if (!idOrCode) return false;
  const deleted = getDeletedTxIds();
  return (
    deleted.includes(idOrCode) ||
    idOrCode === "TX-46-2026-001" ||
    idOrCode === "TX-46-2026-002" ||
    idOrCode === "TX-46-2026-003" ||
    idOrCode === "TX-46-2026-004" ||
    idOrCode === "TX-46-2026-005"
  );
}

export function getStripeHeaders(): Record<string, string> {
  const creds = getStoredStripeCredentials();
  const headers: Record<string, string> = {};
  if (creds?.stripe_secret_key) {
    headers["x-stripe-secret-key"] = creds.stripe_secret_key;
  }
  if (creds?.stripe_publishable_key) {
    headers["x-stripe-publishable-key"] = creds.stripe_publishable_key;
  }
  return headers;
}

export function useLabConfig() {
  const queryClient = useQueryClient();

  const { data: serverConfig, isLoading } = useQuery<LabConfig>({
    queryKey: ["lab-config"],
    queryFn: async () => {
      const stored = getStoredStripeCredentials();
      const headers: Record<string, string> = {};
      if (stored?.stripe_secret_key) {
        headers["x-stripe-secret-key"] = stored.stripe_secret_key;
      }
      if (stored?.stripe_publishable_key) {
        headers["x-stripe-publishable-key"] = stored.stripe_publishable_key;
      }
      const res = await fetch("/app-api/lab-config", { headers });
      if (!res.ok) throw new Error("Errore recupero configurazione lab");
      return res.json();
    },
  });

  const aggiornaConfig = useMutation({
    mutationFn: async (nuovaConfig: Partial<LabConfig>) => {
      // Se vengono passate chiavi stripe, memorizzale subito nel vault locale del dispositivo
      if (
        nuovaConfig.stripe_secret_key !== undefined ||
        nuovaConfig.stripe_publishable_key !== undefined ||
        nuovaConfig.stripe_mode !== undefined ||
        nuovaConfig.stripe_webhook_secret !== undefined
      ) {
        saveStoredStripeCredentials({
          stripe_mode: nuovaConfig.stripe_mode,
          stripe_publishable_key: nuovaConfig.stripe_publishable_key,
          stripe_secret_key: nuovaConfig.stripe_secret_key,
          stripe_webhook_secret: nuovaConfig.stripe_webhook_secret,
        });
      }

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

  // Re-idratazione automatica del backend: se il server (es. dopo cold start Vercel) non ha la chiave
  // ma il vault locale la possiede, inviala in background per riarmare il container
  useEffect(() => {
    if (serverConfig) {
      const stored = getStoredStripeCredentials();
      if (stored && stored.stripe_secret_key && stored.stripe_secret_key.startsWith("sk_")) {
        if (!serverConfig.stripe_secret_key) {
          fetch("/app-api/lab-config", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stripe_mode: stored.stripe_mode || serverConfig.stripe_mode || "live",
              stripe_publishable_key: stored.stripe_publishable_key || serverConfig.stripe_publishable_key || "",
              stripe_secret_key: stored.stripe_secret_key,
              stripe_webhook_secret: stored.stripe_webhook_secret || serverConfig.stripe_webhook_secret || "",
              stripe_collegato: true,
            }),
          })
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ["lab-config"] });
            })
            .catch(() => {});
        }
      }
    }
  }, [serverConfig, queryClient]);

  // Unione garantita: la configurazione salvata nel vault locale sovrascrive i campi vuoti del server
  const mergedConfig = useMemo<LabConfig>(() => {
    const base: LabConfig = serverConfig || {
      tempo_cancellazione_ore: 24,
      iban: "IT46X0306909606100000046460",
      intestatario_iban: "Area46 Training Lab SSD a r.l.",
      banca: "Banca Sella",
      notifica_email: "firenzepersonaltrainer@gmail.com",
      notifica_whatsapp: "+39 340 0000000",
      orari_disponibili: [
        "07:30", "08:30", "09:30", "10:30", "11:30",
        "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
      ],
      giorni_aperti: [1, 2, 3, 4, 5, 6],
      inattivita_mesi_reset: 6,
    };
    const stored = getStoredStripeCredentials();
    if (!stored) return base;

    const hasStoredSecret = !!(stored.stripe_secret_key && stored.stripe_secret_key.trim().length > 0);
    const hasServerSecret = !!(base.stripe_secret_key && base.stripe_secret_key.trim().length > 0);

    return {
      ...base,
      stripe_mode: stored.stripe_mode || base.stripe_mode || "live",
      stripe_publishable_key: stored.stripe_publishable_key || base.stripe_publishable_key || "",
      stripe_secret_key: stored.stripe_secret_key || base.stripe_secret_key || "",
      stripe_webhook_secret: stored.stripe_webhook_secret || base.stripe_webhook_secret || "",
      stripe_collegato: Boolean(
        base.stripe_collegato ||
        (hasStoredSecret && stored.stripe_secret_key!.startsWith("sk_")) ||
        (hasServerSecret && base.stripe_secret_key!.startsWith("sk_"))
      ),
    };
  }, [serverConfig]);

  return {
    config: mergedConfig,
    isLoading,
    aggiornaConfig: aggiornaConfig.mutateAsync,
  };
}

export function useAttivita() {
  const queryClient = useQueryClient();

  const { data: attivita = [ATTIVITA_DEFAULT_LANDMINE], isLoading } = useQuery<AttivitaLab[]>({
    queryKey: ["attivita"],
    queryFn: async () => {
      const res = await fetch("/app-api/attivita");
      if (!res.ok) throw new Error("Errore caricamento attività");
      const json = await res.json();
      return json.length > 0 ? json : [ATTIVITA_DEFAULT_LANDMINE];
    },
  });

  const creaAttivita = useMutation({
    mutationFn: async (nuova: Partial<AttivitaLab>) => {
      const res = await fetch("/app-api/attivita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuova),
      });
      if (!res.ok) throw new Error("Errore creazione attività");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attivita"] });
      toast.success("Attività creata!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore salvataggio attività");
    },
  });

  const aggiornaAttivita = useMutation({
    mutationFn: async ({ id, ...dati }: Partial<AttivitaLab> & { id: string }) => {
      const res = await fetch(`/app-api/attivita/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dati),
      });
      if (!res.ok) throw new Error("Errore modifica attività");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attivita"] });
      toast.success("Attività aggiornata!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore aggiornamento attività");
    },
  });

  const eliminaAttivita = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/app-api/attivita/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione attività");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attivita"] });
      toast.success("Attività eliminata.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore eliminazione attività");
    },
  });

  return {
    attivita,
    isLoading,
    creaAttivita: creaAttivita.mutateAsync,
    aggiornaAttivita: aggiornaAttivita.mutateAsync,
    eliminaAttivita: eliminaAttivita.mutateAsync,
  };
}

export function useRegolePalinsesto() {
  const queryClient = useQueryClient();

  const { data: regole = [REGOLA_DEFAULT_LANDMINE], isLoading } = useQuery<RegolaPalinsesto[]>({
    queryKey: ["regole-palinsesto"],
    queryFn: async () => {
      const res = await fetch("/app-api/regole-palinsesto");
      if (!res.ok) throw new Error("Errore caricamento palinsesto");
      const json = await res.json();
      return json.length > 0 ? json : [REGOLA_DEFAULT_LANDMINE];
    },
  });

  const creaRegola = useMutation({
    mutationFn: async (nuova: Partial<RegolaPalinsesto>) => {
      const res = await fetch("/app-api/regole-palinsesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuova),
      });
      if (!res.ok) throw new Error("Errore creazione regola palinsesto");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regole-palinsesto"] });
      toast.success("Regola di palinsesto creata con successo!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore salvataggio regola");
    },
  });

  const aggiornaRegola = useMutation({
    mutationFn: async ({ id, ...dati }: Partial<RegolaPalinsesto> & { id: string }) => {
      const res = await fetch(`/app-api/regole-palinsesto/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dati),
      });
      if (!res.ok) throw new Error("Errore modifica regola");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regole-palinsesto"] });
      toast.success("Palinsesto aggiornato!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore aggiornamento regola");
    },
  });

  const eliminaRegola = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/app-api/regole-palinsesto/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore eliminazione regola");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["regole-palinsesto"] });
      toast.success("Periodo di palinsesto eliminato.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Errore eliminazione regola");
    },
  });

  return {
    regole,
    isLoading,
    creaRegola: creaRegola.mutateAsync,
    aggiornaRegola: aggiornaRegola.mutateAsync,
    eliminaRegola: eliminaRegola.mutateAsync,
  };
}
