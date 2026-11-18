// The message a Player sends their Agent on WhatsApp for a token request, and
// the reader the Agent's page uses to find the request again. The server's
// stored request is the truth: only the code is ever used to *locate* it, and
// the rest is shown so the Agent can spot a message that has been edited.
//
// (The player app carries its own copy of `buildRequestMessage`; keep the two
// in step — the round-trip test here is what guards the format.)

export type RequestKind = 'TOPUP' | 'RETURN';

export interface RequestMessage {
  code: string;
  player: string;
  kind: RequestKind;
  amount: number;
  note: string;
}

export const REQUEST_HEADER = 'PREDICTSIM-REQ v1';

export function buildRequestMessage(m: RequestMessage): string {
  // One line per field, ASCII, and no characters WhatsApp turns into
  // formatting (* _ ~ `) — so the text survives a copy and paste unchanged.
  const note = m.note.replace(/[\r\n]+/g, ' ').replace(/[*_~`]/g, '').trim().slice(0, 200);
  return [REQUEST_HEADER, `id: ${m.code}`, `player: ${m.player}`, `kind: ${m.kind}`, `amount: ${m.amount}`, `note: ${note}`].join('\n');
}

/**
 * Read a pasted message. Tolerant of what copying a WhatsApp bubble adds
 * (timestamps, sender prefixes, extra blank lines): each field is found by
 * its own label anywhere in the text, and the header must be present.
 */
export function parseRequestMessage(text: string): RequestMessage | null {
  if (!/PREDICTSIM-REQ\s+v1/i.test(text)) return null;
  const code = /\bid\s*:\s*([A-HJ-NP-Za-hj-np-z2-9]{8})\b/.exec(text)?.[1]?.toUpperCase();
  const player = /\bplayer\s*:\s*([A-Za-z0-9_.-]+)/.exec(text)?.[1];
  const kind = /\bkind\s*:\s*(TOPUP|RETURN)\b/i.exec(text)?.[1]?.toUpperCase() as RequestKind | undefined;
  const amountRaw = /\bamount\s*:\s*([\d,]+)/.exec(text)?.[1];
  if (!code || !player || !kind || !amountRaw) return null;
  const amount = Number(amountRaw.replace(/,/g, ''));
  if (!Number.isInteger(amount) || amount < 1) return null;
  const note = /\bnote\s*:[ \t]*([^\n\r]*)/i.exec(text)?.[1]?.trim() ?? '';
  return { code, player, kind, amount, note };
}
