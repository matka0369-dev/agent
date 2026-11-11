import type { UserSummary } from './shared';

// A small client of its own rather than a method on the shared `api`: the
// shared client is vendored from the monorepo and overwritten on every sync,
// and these calls only exist in this app.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const PORTAL: string | undefined = import.meta.env.VITE_PORTAL;

export class InviteApiError extends Error {}

export interface MyInvite {
  whatsappNumber: string | null;
  inviteCode: string;
  inviteUrl: string;
}

export interface LoginLink {
  url: string;
  expiresAt: string;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(PORTAL ? { 'X-Portal': PORTAL } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new InviteApiError(`Cannot reach the API at ${BASE_URL}.`);
  }
  const text = await res.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const raw = payload?.message;
    throw new InviteApiError(Array.isArray(raw) ? raw.join(', ') : (raw ?? res.statusText));
  }
  return payload as T;
}

export const inviteApi = {
  me: () => call<MyInvite>('GET', '/player-access/me'),
  setWhatsapp: (whatsappNumber: string) => call<MyInvite>('PUT', '/player-access/me', { whatsappNumber }),
  invitePlayer: (phone: string) => call<LoginLink & { user: UserSummary }>('POST', '/player-access/players', { phone }),
  reissue: (playerId: string) => call<LoginLink>('POST', `/player-access/${playerId}/login-link`),
};
