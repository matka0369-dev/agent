import { useState } from 'react';
import { Alert, Button, Card, Field, api, type TokenRequest } from './shared';
import { opsApi } from './opsApi';
import { parseRequestMessage, type RequestMessage } from './whatsappRequest';

const KIND_LABEL = { TOP_UP: 'Top-up', RETURN: 'Return', SURRENDER: 'Surrender' } as const;

/**
 * Paste the message a player sent on WhatsApp. Only the code in it is used —
 * to find the player's request in your queue. What is shown is the request as
 * the system has it, with a warning if the pasted text says something else
 * (a message that was edited, or sent for a different request).
 */
export function PasteRequest({ canApprove, onChanged }: { canApprove: boolean; onChanged: () => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<RequestMessage | null>(null);
  const [found, setFound] = useState<TokenRequest | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function find() {
    setError(null);
    setDone(null);
    setFound(null);
    const m = parseRequestMessage(text);
    setParsed(m);
    if (!m) return setError('That does not look like a PredictSim request message. Copy the whole message from WhatsApp.');
    try {
      setFound(await opsApi.lookupRequest(m.code));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function resolve(kind: 'approve' | 'reject') {
    if (!found) return;
    setBusy(true);
    try {
      const fn = kind === 'approve' ? api.approveTokenRequest : api.rejectTokenRequest;
      await fn(found.id, note || undefined);
      setDone(kind === 'approve' ? 'Approved — the tokens have moved.' : 'Rejected — nothing moved.');
      setFound(null);
      setText('');
      setNote('');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const mismatch =
    found && parsed
      ? [
          found.requester.username !== parsed.player && 'the player',
          found.amount !== parsed.amount && 'the amount',
          (found.kind === 'RETURN') !== (parsed.kind === 'RETURN') && 'the kind',
        ].filter(Boolean)
      : [];

  return (
    <Card title="Paste a WhatsApp message" desc="Copy the player's message from WhatsApp and paste it here to find their request.">
      <Field label="Message">
        <textarea className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'PREDICTSIM-REQ v1\nid: …'} />
      </Field>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <Button variant="primary" disabled={!text.trim()} onClick={() => void find()}>Find request</Button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}
      {found && (
        <div style={{ marginTop: 8 }}>
          <div className="field__label">{KIND_LABEL[found.kind]} request {found.shortCode ? `· ${found.shortCode}` : ''}</div>
          <p>
            <strong>{found.requester.username}</strong> — <strong>{found.amount.toLocaleString()}</strong> tokens
            {found.note ? <> · “{found.note}”</> : null}
            {found.imageMimeType && (
              <> · <a href={api.tokenRequestImageUrl(found.id)} target="_blank" rel="noreferrer">attached image</a></>
            )}
          </p>
          {mismatch.length > 0 && (
            <Alert tone="error">The pasted message differs from the request on {mismatch.join(' and ')}. The amounts above are what the system has.</Alert>
          )}
          {found.status !== 'PENDING' ? (
            <Alert tone="info">This request is already {found.status.toLowerCase()}.</Alert>
          ) : (
            <>
              <Field label="Note (optional)">
                <input className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="btn-row">
                {canApprove ? (
                  <Button variant="primary" disabled={busy} onClick={() => void resolve('approve')}>Approve</Button>
                ) : (
                  <span className="note">Approving needs a staff account with the Finance role.</span>
                )}
                <Button disabled={busy} onClick={() => void resolve('reject')}>Reject</Button>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
