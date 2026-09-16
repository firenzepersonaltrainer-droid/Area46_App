export interface AppUser {
  id: string;
  email: string;
  name: string;
  nome?: string;
  cognome?: string;
  telefono?: string;
  codice_fiscale?: string;
  indirizzo?: string;
  ruolo?: "manager" | "atleta";
  crediti?: number;
  data_scadenza_crediti?: string;
  data_ultimo_accesso?: string;
  note_coach?: string;
}

export interface AuthClient {
  user: () => AppUser;
}

export interface SessionClient {
  get: () => Promise<AppUser>;
}

export const DEMO_USER: AppUser = {
  id: "usr-coach-01",
  email: "coach@area46.it",
  name: "Coach Area46",
  nome: "Coach",
  cognome: "Area46",
  ruolo: "manager",
  crediti: 999,
};

export function auth(_c?: any): AuthClient {
  return {
    user: () => DEMO_USER,
  };
}

export const session: SessionClient = {
  get: async () => {
    try {
      const res = await fetch("/app-api/auth/current-user");
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // fallback in caso di SSR o mancata connettività
    }
    return DEMO_USER;
  },
};

export function signOut(): void {
  console.log("Area46 Demo mode: sessione attiva.");
}
