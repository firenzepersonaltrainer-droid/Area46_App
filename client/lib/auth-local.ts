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

export function auth(c?: any): AuthClient {
  let user: AppUser | null = null;
  if (c && c.req) {
    const headerId = c.req.header("x-area46-user") || c.req.header("x-user-id");
    const cookieHeader = c.req.header("cookie");
    const match = cookieHeader?.match(/area46_user_id=([^;]+)/);
    const cookieId = match ? decodeURIComponent(match[1]) : null;
    const candidate = headerId || cookieId;
    if (candidate) {
      user = { id: candidate, email: candidate, name: candidate };
    }
  }
  return {
    user: () => user,
  };
}

export const session: SessionClient = {
  get: async () => {
    try {
      const res = await fetch("/app-api/auth/current-user");
      if (res.ok) {
        const data = await res.json();
        return data || null;
      }
    } catch {
      // fallback in caso di SSR o mancata connettività
    }
    return null as any;
  },
};

export function signOut(): void {
  // Session sign out
}
