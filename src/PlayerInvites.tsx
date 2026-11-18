import { useCallback, useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Alert, Button, Card, CopyButton, Empty, Field, TableWrap, type UserSummary } from './shared';
import { inviteApi, InviteApiError, type ContactPurpose, type LoginLink, type MyInvite } from './inviteApi';

const errText = (e: unknown) => (e instanceof InviteApiError || e instanceof Error ? e.message : String(e));

function qrDataUrl(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(6, 2);
}

// Digits-with-country-code, the shape a wa.me link needs. A Player's "email"
// column holds whatever the Agent typed, so only offer WhatsApp when it's
// really a phone number.
const asWhatsappNumber = (raw: string): string | null => {
  const compact = raw.replace(/[\s-]/g, '');
  return /^\+?[0-9]{11,15}$/.test(compact) ? compact.replace('+', '') : null;
};

const whatsappHref = (phone: string, url: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(`🎯 PredictSim\n${url}`)}`;

/** A freshly issued sign-in link: shown once, as a QR to scan in person and a
 *  WhatsApp button to send remotely. The page never stores it — the server
 *  keeps only a hash, so closing this loses the link for good. */
function LinkPanel({
  heading,
  link,
  phone,
  onClose,
}: {
  heading: string;
  link: LoginLink;
  phone: string | null;
  onClose: () => void;
}) {
  const qr = useMemo(() => qrDataUrl(link.url), [link.url]);
  return (
    <Card title={heading} desc="Valid for 1 hour, and works once. The player opens it and picks a 4-digit PIN.">
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <img src={qr} alt="Sign-in QR code" width={180} height={180} style={{ imageRendering: 'pixelated' }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="btn-row" style={{ marginBottom: 12 }}>
            {phone && (
              <a className="btn btn--primary" href={whatsappHref(phone, link.url)} target="_blank" rel="noreferrer">
                Send on WhatsApp
              </a>
            )}
            <CopyButton getText={() => link.url} />
            <Button onClick={onClose}>Done</Button>
          </div>
          <div className="note">
            Anyone who opens this link first becomes this player, so send it only to them.
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * How an Agent gets players in the door and back in:
 *  1. share the invite link (or an APK built with its code) — players sign
 *     themselves up with a name, phone and PIN, and land under this Agent;
 *  2. publish WhatsApp numbers (help, token requests) — the player app puts a
 *     chat button for each where it fits, and on the sign-up screen for anyone
 *     who is stuck (a number that's already registered, a locked phone);
 *  3. for a lost phone or forgotten PIN, issue that player a new link.
 * The Agent creates nobody and sets nobody's PIN. Odds stay the Agent's: players
 * read this Agent's rate card.
 */
export function PlayerInvites({ players }: { players: UserSummary[] }) {
  const [invite, setInvite] = useState<MyInvite | null>(null);
  const [draft, setDraft] = useState<Record<ContactPurpose, string>>({ support: '', tokens: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ heading: string; link: LoginLink; phone: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await inviteApi.me();
      setInvite(me);
      setDraft({ support: me.contacts.support ?? '', tokens: me.contacts.tokens ?? '' });
      setError(null);
    } catch (e) {
      setError(errText(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const saveContacts = () =>
    run(async () => {
      const me = await inviteApi.setContacts({
        support: draft.support.trim() || null,
        tokens: draft.tokens.trim() || null,
      });
      setInvite(me);
      setDraft({ support: me.contacts.support ?? '', tokens: me.contacts.tokens ?? '' });
    });

  const contactsChanged =
    invite !== null &&
    (draft.support.trim() !== (invite.contacts.support ?? '') || draft.tokens.trim() !== (invite.contacts.tokens ?? ''));

  const reissue = (p: UserSummary) => {
    if (!window.confirm(`Give ${p.username} a new link? This signs them out everywhere and replaces their PIN.`)) return;
    void run(async () => {
      const link = await inviteApi.reissue(p.id);
      setIssued({ heading: `New sign-in link for ${p.username}`, link, phone: asWhatsappNumber(p.email) });
    });
  };

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      <Card
        title="Player sign-up"
        desc="Players create their own account in the app — they enter a name, a phone number and choose a 4-digit PIN. You don't need to add anyone."
      >
        <div className="field__label" style={{ marginTop: 4 }}>Your WhatsApp numbers</div>
        <div className="note" style={{ marginBottom: 8 }}>
          Players get a "chat on WhatsApp" button for each number you set, in the place it fits. Include the country
          code, e.g. 919876543210.
        </div>
        <Field label="Help & questions" hint="Shown on the player's home screen and on the sign-up screen.">
          <input
            className="input"
            inputMode="tel"
            value={draft.support}
            onChange={(e) => setDraft({ ...draft, support: e.target.value })}
            placeholder="919876543210"
          />
        </Field>
        <Field label="Token requests" hint="Shown next to Request tokens. Leave empty to use your help number.">
          <input
            className="input"
            inputMode="tel"
            value={draft.tokens}
            onChange={(e) => setDraft({ ...draft, tokens: e.target.value })}
            placeholder="Same as help"
          />
        </Field>
        <div className="btn-row">
          <Button variant="primary" disabled={busy || !contactsChanged} onClick={() => void saveContacts()}>
            Save numbers
          </Button>
        </div>
        {invite && (
          <div style={{ marginTop: 16 }}>
            <div className="field__label">Your sign-up link — share it with players</div>
            <div className="note" style={{ wordBreak: 'break-all' }}>
              {invite.inviteUrl}
            </div>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <CopyButton getText={() => invite.inviteUrl} />
            </div>
          </div>
        )}
      </Card>

      {issued && <LinkPanel {...issued} onClose={() => setIssued(null)} />}

      <Card title="Lost phone or forgot PIN?" desc="Give a player a new link. It signs them out everywhere and replaces their PIN." flush>
        {players.length === 0 ? (
          <Empty>No players yet.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Player</th>
                <th>Phone / email</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td className="cell-strong">{p.username}</td>
                  <td className="cell-muted">{p.email}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Button size="sm" disabled={busy || !p.isActive} onClick={() => reissue(p)}>
                      New link
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
