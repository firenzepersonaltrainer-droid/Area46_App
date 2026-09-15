import type { AppUser, AuthClient, SessionClient } from "../../auth";

export const DEMO_USER: AppUser = {
  id: "demo-coach-46",
  email: "coach@area46.it",
  name: "Coach Area46",
};

export function auth(_c?: any): AuthClient {
  return {
    user: () => DEMO_USER,
  };
}

export const session: SessionClient = {
  get: async () => DEMO_USER,
};

export function signOut(): void {
  console.log("Demo mode: sessione coach sempre attiva.");
}
