import { describe, expect, it } from 'vitest';
import { buildRequestMessage, parseRequestMessage, REQUEST_HEADER } from '../whatsappRequest';

const msg = { code: 'K7Q2M9PX', player: 'ramesh_4821', kind: 'TOPUP' as const, amount: 1500, note: 'for tonight' };

describe('request message', () => {
  it('round-trips', () => expect(parseRequestMessage(buildRequestMessage(msg))).toEqual(msg));

  it('survives what copying a WhatsApp bubble adds', () => {
    const pasted = `[16:41, 18/11/2026] Ramesh: ${buildRequestMessage(msg).replace('\n', '\n\n')}\n\n`;
    expect(parseRequestMessage(pasted)).toEqual(msg);
  });

  it('reads a lower-case code and a comma in the amount', () => {
    const t = `${REQUEST_HEADER}\nid: k7q2m9px\nplayer: a_b\nkind: return\namount: 1,500\nnote:`;
    expect(parseRequestMessage(t)).toMatchObject({ code: 'K7Q2M9PX', kind: 'RETURN', amount: 1500, note: '' });
  });

  it('strips formatting characters and line breaks from the note', () => {
    const built = buildRequestMessage({ ...msg, note: '*please*\nhurry_up' });
    expect(built.split('\n')).toHaveLength(6);
    expect(built.split('\n')[5]).toBe('note: please hurryup');
  });

  it('refuses anything that is not a request message', () => {
    expect(parseRequestMessage('hello, I need tokens')).toBeNull();
    expect(parseRequestMessage(`${REQUEST_HEADER}\nid: K7Q2M9PX\nplayer: x\nkind: TOPUP`)).toBeNull(); // no amount
    expect(parseRequestMessage(`${REQUEST_HEADER}\nid: 1234\nplayer: x\nkind: TOPUP\namount: 5`)).toBeNull(); // bad code
    expect(parseRequestMessage(`${REQUEST_HEADER}\nid: K7Q2M9PX\nplayer: x\nkind: TOPUP\namount: 0`)).toBeNull();
  });
});
