import { useState, useCallback, useMemo } from "react";
import { Stato, statoKey } from "./useAllenamentiStati";

export interface GiornoItemLite {
  giorno?: string;
  giorno_num: number;
  settimana?: string;
  livello?: string;
}

const STORAGE_PREFIX_APERTURE = "area46_approfondimento_aperture_";
const STORAGE_PREFIX_DISMISSED = "area46_approfondimento_dismissed_";

export function getApprofondimentoApertureKey(userId: string | null | undefined, approfondimentoId: string): string {
  const uid = userId || "default_user";
  return `${STORAGE_PREFIX_APERTURE}${uid}_${approfondimentoId}`;
}

export function getApprofondimentoDismissedKey(userId: string | null | undefined, approfondimentoId: string): string {
  const uid = userId || "default_user";
  return `${STORAGE_PREFIX_DISMISSED}${uid}_${approfondimentoId}`;
}

export function getApprofondimentoApertureCount(userId: string | null | undefined, approfondimentoId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(getApprofondimentoApertureKey(userId, approfondimentoId));
    if (!raw) return 0;
    const num = parseInt(raw, 10);
    return isNaN(num) ? 0 : num;
  } catch {
    return 0;
  }
}

export function isApprofondimentoDismissed(userId: string | null | undefined, approfondimentoId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(getApprofondimentoDismissedKey(userId, approfondimentoId)) === "true";
  } catch {
    return false;
  }
}

export function setApprofondimentoDismissed(userId: string | null | undefined, approfondimentoId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getApprofondimentoDismissedKey(userId, approfondimentoId), "true");
  } catch {
    // Ignora errori di storage
  }
}

export function incrementApprofondimentoAperture(
  userId: string | null | undefined,
  approfondimentoId: string
): number {
  if (typeof window === "undefined") return 0;
  try {
    const key = getApprofondimentoApertureKey(userId, approfondimentoId);
    const current = getApprofondimentoApertureCount(userId, approfondimentoId);
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return 0;
  }
}

export interface UseApprofondimentoCicloOptions {
  approfondimentoId: string;
  livelloTarget: string; // es. "PRO"
  cicloSblocco: string; // es. "Ciclo 5"
  cicloSuccessivo: string; // es. "Ciclo 6"
  maxAperture?: number; // default: 3
  userId?: string | null;
  livelloAttivo?: string | null;
  giorni: GiornoItemLite[];
  statoMap: Map<string, Stato>;
  correnteItem?: { item: GiornoItemLite; tipo: Stato } | null;
}

export function useApprofondimentoCicloVisibility({
  approfondimentoId,
  livelloTarget,
  cicloSblocco,
  cicloSuccessivo,
  maxAperture = 3,
  userId,
  livelloAttivo,
  giorni,
  statoMap,
  correnteItem,
}: UseApprofondimentoCicloOptions) {
  const [aperture, setAperture] = useState<number>(() =>
    getApprofondimentoApertureCount(userId, approfondimentoId)
  );
  const [dismissed, setDismissed] = useState<boolean>(() =>
    isApprofondimentoDismissed(userId, approfondimentoId)
  );

  const registraApertura = useCallback(() => {
    const next = incrementApprofondimentoAperture(userId, approfondimentoId);
    setAperture(next);
  }, [userId, approfondimentoId]);

  const nascondiDaHome = useCallback(() => {
    setApprofondimentoDismissed(userId, approfondimentoId);
    setDismissed(true);
  }, [userId, approfondimentoId]);

  const isLivelloCoincidente = useMemo(() => {
    const lv = (livelloAttivo || correnteItem?.item.livello || "").trim().toUpperCase();
    return lv === livelloTarget.trim().toUpperCase();
  }, [livelloAttivo, correnteItem, livelloTarget]);

  // Controlla se l'atleta ha raggiunto o concluso il ciclo di sblocco (es. Ciclo 5)
  // Per il Livello PRO: Ciclo 5 corrisponde ai giorni 25-30
  const isCicloSbloccoRaggiunto = useMemo(() => {
    if (!isLivelloCoincidente) return false;
    const itemsSblocco = (giorni || []).filter((g) => {
      const s = (g.settimana || "").trim();
      return s.toLowerCase() === cicloSblocco.toLowerCase();
    });

    if (itemsSblocco.length === 0) {
      // Fallback su giorno_num se non trova per stringa: per Ciclo 5 sono i giorni 25-30
      const matchNum = cicloSblocco.match(/\d+/);
      const cNum = matchNum ? parseInt(matchNum[0], 10) : 5;
      const startGiorno = (cNum - 1) * 6 + 1;
      const endGiorno = cNum * 6;
      const itemsNum = (giorni || []).filter((g) => g.giorno_num >= startGiorno && g.giorno_num <= endGiorno);
      if (itemsNum.length === 0) return true;
      return itemsNum.every((it) => statoMap.get(statoKey(it.livello || livelloTarget, it.giorno_num)) === "completato");
    }

    const tuttiCompletatiSblocco = itemsSblocco.every((it) =>
      statoMap.get(statoKey(it.livello || livelloTarget, it.giorno_num)) === "completato"
    );

    // Se tutti gli allenamenti del ciclo di sblocco sono completati
    if (tuttiCompletatiSblocco) return true;

    // Se l'atleta ha già iniziato il ciclo successivo (almeno un allenamento del ciclo successivo in corso o completato)
    const itemsSuccessivi = (giorni || []).filter((g) => {
      const s = (g.settimana || "").trim();
      return s.toLowerCase() === cicloSuccessivo.toLowerCase();
    });
    const haIniziatoSuccessivo = itemsSuccessivi.some((it) => {
      const st = statoMap.get(statoKey(it.livello || livelloTarget, it.giorno_num));
      return st === "in_corso" || st === "completato";
    });

    return haIniziatoSuccessivo;
  }, [isLivelloCoincidente, giorni, cicloSblocco, cicloSuccessivo, statoMap, livelloTarget]);

  // Controlla se il ciclo successivo (es. Ciclo 6) è CONCLUSO
  // Regola Stefano: "oppure concluso il ciclo successivo, non vengono più mostrati"
  const isCicloSuccessivoConcluso = useMemo(() => {
    if (!isLivelloCoincidente) return false;
    const itemsSuccessivi = (giorni || []).filter((g) => {
      const s = (g.settimana || "").trim();
      return s.toLowerCase() === cicloSuccessivo.toLowerCase();
    });

    if (itemsSuccessivi.length > 0) {
      const tuttiCompletatiSuccessivo = itemsSuccessivi.every((it) =>
        statoMap.get(statoKey(it.livello || livelloTarget, it.giorno_num)) === "completato"
      );
      if (tuttiCompletatiSuccessivo) return true;
    } else {
      // Fallback numerico per PRO: Ciclo 6 sono i giorni 31-36
      const itemsNum = (giorni || []).filter((g) => g.giorno_num >= 31 && g.giorno_num <= 36);
      if (itemsNum.length > 0) {
        const tuttiCompletati = itemsNum.every((it) =>
          statoMap.get(statoKey(it.livello || livelloTarget, it.giorno_num)) === "completato"
        );
        if (tuttiCompletati) return true;
      }
    }

    // Se l'allenamento corrente è oltre il ciclo successivo (es. Ciclo 7+ o giorno > 36)
    if (correnteItem?.item) {
      const gNum = correnteItem.item.giorno_num;
      const sett = (correnteItem.item.settimana || "").toLowerCase();
      const matchCiclo = sett.match(/ciclo\s*(\d+)/i);
      if (matchCiclo) {
        const numCicloCorrente = parseInt(matchCiclo[1], 10);
        const matchSucc = cicloSuccessivo.match(/\d+/);
        const numCicloSucc = matchSucc ? parseInt(matchSucc[0], 10) : 6;
        if (numCicloCorrente > numCicloSucc) return true;
      } else if (gNum > 36) {
        return true;
      }
    }

    return false;
  }, [isLivelloCoincidente, giorni, cicloSuccessivo, statoMap, livelloTarget, correnteItem]);

  const isMaxApertureRaggiunto = aperture >= maxAperture;

  // Visibile nella home sotto "prossimo allenamento" solo se:
  // 1. Livello target coincide
  // 2. Ha sbloccato l'approfondimento (fine ciclo 5 / in ciclo 6)
  // 3. NON ha ancora concluso il ciclo successivo (Ciclo 6 non completato)
  // 4. NON ha superato il numero massimo di aperture (es. < 3 aperture)
  // 5. NON è stato espressamente dismesso
  const visibileInHome =
    isLivelloCoincidente &&
    isCicloSbloccoRaggiunto &&
    !isCicloSuccessivoConcluso &&
    !isMaxApertureRaggiunto &&
    !dismissed;

  return {
    visibileInHome,
    isCicloSuccessivoConcluso,
    isMaxApertureRaggiunto,
    aperture,
    maxAperture,
    dismissed,
    registraApertura,
    nascondiDaHome,
  };
}

export function useApprofondimentoProCiclo5Visibility(options: {
  userId?: string | null;
  livello?: string | null;
  giorni: GiornoItemLite[];
  statoMap: Map<string, Stato>;
  correnteItem?: { item: GiornoItemLite; tipo: Stato } | null;
  maxAperture?: number;
}) {
  return useApprofondimentoCicloVisibility({
    approfondimentoId: "pro_ciclo_5_6",
    livelloTarget: "PRO",
    cicloSblocco: "Ciclo 5",
    cicloSuccessivo: "Ciclo 6",
    maxAperture: options.maxAperture ?? 3,
    userId: options.userId,
    livelloAttivo: options.livello,
    giorni: options.giorni,
    statoMap: options.statoMap,
    correnteItem: options.correnteItem,
  });
}
