import { useCallback, useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Alert, Button, Card, CopyButton, Empty, Field, TableWrap, type UserSummary } from './shared';
import { inviteApi, InviteApiError, type LoginLink, type MyInvite } from './inviteApi';

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
 * How an Agent brings players in and gets them back in:
 *  1. publish a WhatsApp number — the Register button in the player app opens
 *     a chat with it;
 *  2. when a player messages, create them from their number and send a
 *     one-time sign-in link;
 *  3. for a lost phone or forgotten PIN, issue a new link.
 * Nobody types a password; the player picks a PIN on their own phone.
 */
export function PlayerInvites({ players, onChanged }: { players: UserSummary[]; onChanged: () => void }) {
  const [invite, setInvite] = useState<MyInvite | null>(null);
  const [number, setNumber] = useState('');
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ heading: string; link: LoginLink; phone: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await inviteApi.me();
      setInvite(me);
      setNumber(me.whatsappNumber ?? '');
      setEditing(!me.whatsappNumber);
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

  const saveNumber = () =>
    run(async () => {
      const me = await inviteApi.setWhatsapp(number);
      setInvite(me);
      setNumber(me.whatsappNumber ?? '');
      setEditing(false);
    });

  const createPlayer = () =>
    run(async () => {
      const res = await inviteApi.invitePlayer(phone);
      setIssued({
        heading: `Sign-in link for ${res.user.username}`,
        link: { url: res.url, expiresAt: res.expiresAt },
        phone: asWhatsappNumber(phone),
      });
      setPhone('');
      onChanged();
    });

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
        title="Your WhatsApp"
        desc="The number the Register button opens in your players' app. Include the country code, e.g. 919876543210."
      >
        {editing || !invite?.whatsappNumber ? (
          <>
            <Field label="WhatsApp number">
              <input
                className="input"
                inputMode="tel"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="919876543210"
              />
            </Field>
            <div className="btn-row">
              <Button variant="primary" disabled={busy || number.trim() === ''} onClick={() => void saveNumber()}>
                Save
              </Button>
              {invite?.whatsappNumber && <Button onClick={() => setEditing(false)}>Cancel</Button>}
            </div>
          </>
        ) : (
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <strong className="cell-num">+{invite.whatsappNumber}</strong>
            <Button size="sm" onClick={() => setEditing(true)}>
              Change
            </Button>
          </div>
        )}
        {invite && (
          <div style={{ marginTop: 16 }}>
            <div className="field__label">Your invite link</div>
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

      <Card
        title="New player"
        desc="When someone messages you to register, enter their WhatsApp number. This creates their account and gives you a sign-in link for them."
      >
        <Field label="Player's WhatsApp number" hint="With country code, e.g. 919876543210.">
          <input
            className="input"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="919876543210"
          />
        </Field>
        <Button variant="primary" disabled={busy || phone.trim() === ''} onClick={() => void createPlayer()}>
          Create player + get link
        </Button>
      </Card>

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
