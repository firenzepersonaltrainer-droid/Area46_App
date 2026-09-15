import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Hook condiviso per la memoria del livello selezionato.
 *
 * - Legge la preferenza dal DB via /app-api/preferenze (per-utente, persistente).
 * - Espone `livello` (string) e `setLivello` (salva nel DB + aggiorna la cache React Query).
 * - Usato sia in AllenamentiPage che in ArchivioAllenamentiPage, così la scelta
 *   sopravvive ai cambi di Tab e all'archivio.
 */
export function useLivelloMemoria() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ memoria_livello: string | null }>({
    queryKey: ["preferenze"],
    queryFn: () => fetch("/app-api/preferenze").then((r) => r.json()),
    staleTime: 5 * 60 * 1000, // 5 min — la preferenza cambia raramente
  });

  // Valore corrente: stringa vuota = "tutti i livelli"
  const livello = data?.memoria_livello ?? "";

  const setLivello = useCallback(
    async (nuovoLivello: string) => {
      // 1. Aggiorna la cache React Query immediatamente (UI reattiva)
      queryClient.setQueryData(["preferenze"], {
        memoria_livello: nuovoLivello || null,
      });

      // 2. Persiste nel DB (fire-and-forget — non blocca la UI)
      fetch("/app-api/preferenze/livello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livello: nuovoLivello || null }),
      }).catch(() => {
        // In caso di errore di rete, il valore in cache è già aggiornato
        // e alla prossima navigazione verrà letto dal DB.
      });
    },
    [queryClient],
  );

  return { livello, setLivello, isLoading };
}