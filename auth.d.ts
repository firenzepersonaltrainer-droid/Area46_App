// AUTO-GENERATED — do not edit. Typed contract + usage docs for the Glide
// `auth` helper. The implementation is provided by the platform and injected
// at build time; THIS file is what you read and import against. Import the
// helper as "./auth" (server) or "../auth" (client).

export interface AppUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthClient {
  user(): AppUser | null;
}

export interface SessionClient {
  get(): Promise<AppUser | null>;
}

export function auth(c: any): AuthClient;
export const session: SessionClient;
export function signOut(): void;