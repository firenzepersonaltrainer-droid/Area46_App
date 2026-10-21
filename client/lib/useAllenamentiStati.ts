import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser, getActiveUserId } from "./useUser";

export type StatoAllenamento = "non_iniziato" | "in_corso" | "completato";

export interface StatoRecord {
  livello: string;
  giorno: number;
  stato: StatoAllenamento;
  updated_at: string;
  email_cliente?: string;
}

export function statoKey(livello: string, giornoNum: number): string {
  const cleanLivello = (livello || "").trim().toLowerCase();
  const num = Number(giornoNum) || 0;
  return `${cleanLivello}-${num}`;
}

const LOCAL_STORAGE_KEY_PREFIX = "area46_stati_v2_";
const FALLBACK_DEFAULT_EMAIL = "firenzepersonaltrainer@gmail.com";

function getStorageKey(email?: string | null): string {
  const clean = (email || "").trim().toLowerCase();
  return `${LOCAL_STORAGE_KEY_PREFIX}${clean || "default_user"}`;
}

function loadLocalStati(email?: string | null): StatoRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getStorageKey(email);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Prova fallback generico se chiave specifica non esiste
      const fallbackRaw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}default_user`);
      return fallbackRaw ? JSON.parse(fallbackRaw) : [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalStati(email: string | null | undefined, records: StatoRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(records);
    localStorage.setItem(getStorageKey(email), serialized);
    // Salva sempre anche copia nel default per continuità offline / cambio utente
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}default_user`, serialized);
  } catch (err) {
    console.warn("Impossibile salvare stati su localStorage", err);
  }
}

function mergeStatiRecords(base: StatoRecord[], incoming: StatoRecord[]): StatoRecord[] {
  const map = new Map<string, StatoRecord>();
  for (const item of base || []) {
    if (!item) continue;
    map.set(statoKey(item.livello, Number(item.giorno)), item);
  }
  for (const item of incoming || []) {
    if (!item) continue;
    const key = statoKey(item.livello, Number(item.giorno));
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const existingTime = new Date(existing.updated_at || 0).getTime();
      const incomingTime = new Date(item.updated_at || 0).getTime();
      if (incomingTime >= existingTime) {
        map.set(key, item);
      }
    }
  }
  return Array.from(map.values());
}

export function fetchWithAuth(url: string, options: RequestInit = {}) {
  const storedId = getActiveUserId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (storedId) {
    headers["x-area46-user"] = storedId;
    headers["x-user-id"] = storedId;
  }
  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

export function useAllenamentiStati() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const effectiveEmail = (user?.email || FALLBACK_DEFAULT_EMAIL).trim().toLowerCase();

  // 1. Stato locale immediato da LocalStorage (0ms latency, anti-revert)
  const [localStati, setLocalStati] = useState<StatoRecord[]>(() => loadLocalStati(effectiveEmail));

  // Ascolta eventi tra finestre e tab
  useEffect(() => {
    function handleStorageOrSync() {
      const refreshed = loadLocalStati(effectiveEmail);
      setLocalStati(refreshed);
    }
    window.addEventListener("area46:stati_changed", handleStorageOrSync);
    window.addEventListener("storage", handleStorageOrSync);
    return () => {
      window.removeEventListener("area46:stati_changed", handleStorageOrSync);
      window.removeEventListener("storage", handleStorageOrSync);
    };
  }, [effectiveEmail]);

  // 2. Query React Query con server
  const { data: serverStati = [], isLoading, refetch } = useQuery<StatoRecord[]>({
    queryKey: ["stati_allenamenti_v2", effectiveEmail],
    queryFn: async () => {
      try {
        const res = await fetchWithAuth(`/app-api/stati?email=${encodeURIComponent(effectiveEmail)}`);
        if (!res.ok) return localStati;
        const data = await res.json();
        const records = Array.isArray(data) ? (data as StatoRecord[]) : [];
        // Merge con il nostro storage locale
        const merged = mergeStatiRecords(loadLocalStati(effectiveEmail), records);
        saveLocalStati(effectiveEmail, merged);
        setLocalStati(merged);
        return merged;
      } catch {
        return loadLocalStati(effectiveEmail);
      }
    },
    staleTime: 10 * 1000,
  });

  // Lista unificata prioritizzando sempre la versione più recente
  const stati = useMemo(() => {
    return mergeStatiRecords(serverStati, localStati);
  }, [serverStati, localStati]);

  // Map per lookup O(1)
  const statoMap = useMemo(() => {
    const map = new Map<string, StatoAllenamento>();
    for (const s of stati) {
      map.set(statoKey(s.livello, Number(s.giorno)), s.stato);
    }
    return map;
  }, [stati]);

  const getStato = useCallback(
    (livello: string, giornoNum: number): StatoAllenamento => {
      return statoMap.get(statoKey(livello, giornoNum)) || "non_iniziato";
    },
    [statoMap]
  );

  // Aggiorna stato singolo
  const setStato = useCallback(
    async (livello: string, giornoNum: number, nuovoStato: StatoAllenamento) => {
      const nowIso = new Date().toISOString();
      const updatedItem: StatoRecord = {
        livello: (livello || "").trim(),
        giorno: Number(giornoNum),
        stato: nuovoStato,
        updated_at: nowIso,
        email_cliente: effectiveEmail,
      };

      // 1. Aggiornamento sincrono LocalStorage (Immediato & Permanente)
      const current = loadLocalStati(effectiveEmail);
      const targetKey = statoKey(livello, giornoNum);
      const filtered = current.filter(
        (s) => statoKey(s.livello, Number(s.giorno)) !== targetKey
      );
      const nextRecords = [...filtered, updatedItem];
      saveLocalStati(effectiveEmail, nextRecords);
      setLocalStati(nextRecords);

      // Notifica tutti i componenti attivi nella pagina
      window.dispatchEvent(new Event("area46:stati_changed"));

      // 2. Aggiornamento ottimistico cache React Query
      queryClient.setQueryData<StatoRecord[]>(
        ["stati_allenamenti_v2", effectiveEmail],
        nextRecords
      );
      queryClient.setQueriesData<StatoRecord[]>({ queryKey: ["stati"] }, nextRecords);

      // 3. Persistenza Backend
      try {
        await fetchWithAuth("/app-api/stati", {
          method: "POST",
          body: JSON.stringify({
            livello: (livello || "").trim(),
            giorno: Number(giornoNum),
            giornoNum: Number(giornoNum),
            stato: nuovoStato,
            email_cliente: effectiveEmail,
          }),
        });
        queryClient.invalidateQueries({ queryKey: ["diario"] });
      } catch (err) {
        console.warn("Sincronizzazione backend posticipata", err);
      }
    },
    [effectiveEmail, queryClient]
  );

  // Toggle rapido giorno: se completato torna non iniziato, altrimenti completato
  const toggleGiorno = useCallback(
    async (livello: string, giornoNum: number): Promise<StatoAllenamento> => {
      const curr = getStato(livello, giornoNum);
      const next: StatoAllenamento = curr === "completato" ? "non_iniziato" : "completato";
      await setStato(livello, giornoNum, next);
      return next;
    },
    [getStato, setStato]
  );

  // Aggiorna gruppo di allenamenti in blocco (batch)
  const setBatchStato = useCallback(
    async (
      updates: Array<{ livello: string; giornoNum: number; stato: StatoAllenamento }>
    ) => {
      if (!updates || updates.length === 0) return;
      const nowIso = new Date().toISOString();
      const updateMap = new Map(
        updates.map((u) => [statoKey(u.livello, u.giornoNum), u.stato])
      );

      // 1. Aggiornamento LocalStorage sincrono
      const current = loadLocalStati(effectiveEmail);
      const existingKeys = new Set(
        current.map((s) => statoKey(s.livello, Number(s.giorno)))
      );

      const updatedExisting = current.map((s) => {
        const k = statoKey(s.livello, Number(s.giorno));
        if (updateMap.has(k)) {
          return { ...s, stato: updateMap.get(k)!, updated_at: nowIso };
        }
        return s;
      });

      const newItems = updates
        .filter((u) => !existingKeys.has(statoKey(u.livello, u.giornoNum)))
        .map((u) => ({
          livello: (u.livello || "").trim(),
          giorno: Number(u.giornoNum),
          stato: u.stato,
          updated_at: nowIso,
          email_cliente: effectiveEmail,
        }));

      const nextRecords = [...updatedExisting, ...newItems];
      saveLocalStati(effectiveEmail, nextRecords);
      setLocalStati(nextRecords);

      // Notifica globale
      window.dispatchEvent(new Event("area46:stati_changed"));

      // 2. Cache React Query
      queryClient.setQueryData<StatoRecord[]>(
        ["stati_allenamenti_v2", effectiveEmail],
        nextRecords
      );
      queryClient.setQueriesData<StatoRecord[]>({ queryKey: ["stati"] }, nextRecords);

      // 3. Persistenza atomica Backend
      try {
        await fetchWithAuth("/app-api/stati/batch", {
          method: "POST",
          body: JSON.stringify({
            email_cliente: effectiveEmail,
            updates: updates.map((u) => ({
              livello: (u.livello || "").trim(),
              giorno: Number(u.giornoNum),
              giornoNum: Number(u.giornoNum),
              stato: u.stato,
            })),
          }),
        });
        queryClient.invalidateQueries({ queryKey: ["diario"] });
      } catch (err) {
        console.warn("Sincronizzazione batch backend posticipata", err);
      }
    },
    [effectiveEmail, queryClient]
  );

  // Verifica se tutti gli allenamenti di un ciclo sono completati
  const isCicloCompletato = useCallback(
    (
      items: Array<{ livello?: string; giorno_num: number }>,
      targetLivello?: string
    ): boolean => {
      if (!items || items.length === 0) return false;
      return items.every((item) => {
        const lv = (item.livello || targetLivello || "").trim();
        return statoMap.get(statoKey(lv, item.giorno_num)) === "completato";
      });
    },
    [statoMap]
  );

  // Toggle dell'intero ciclo: se tutti completati -> non iniziato, altrimenti completato
  const toggleCiclo = useCallback(
    async (
      items: Array<{ livello?: string; giorno_num: number }>,
      targetLivello?: string
    ): Promise<boolean> => {
      if (!items || items.length === 0) return false;
      const tuttiCompletati = items.every((item) => {
        const lv = (item.livello || targetLivello || "").trim();
        return statoMap.get(statoKey(lv, item.giorno_num)) === "completato";
      });

      const nuovoStato: StatoAllenamento = tuttiCompletati ? "non_iniziato" : "completato";
      const updates = items.map((item) => ({
        livello: (item.livello || targetLivello || "").trim(),
        giornoNum: item.giorno_num,
        stato: nuovoStato,
      }));

      await setBatchStato(updates);
      return nuovoStato === "completato";
    },
    [statoMap, setBatchStato]
  );

  return {
    stati,
    statoMap,
    isLoading,
    refetch,
    getStato,
    setStato,
    toggleGiorno,
    setBatchStato,
    isCicloCompletato,
    toggleCiclo,
  };
}
