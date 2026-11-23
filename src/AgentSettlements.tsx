import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Empty, Field, RefreshButton, TableWrap, predictionTypeLabel, useLang, type PredictionType } from './shared';
import { call } from './inviteApi';
import { dayString } from './predictionsStore';
import './filterRow.css';

/** A settlement row as the server sends it to an Agent. The three share fields
 *  are new, so a server that has not been updated yet leaves them out. */
interface Row {
  id: string;
  date: string;
  gameName: string;
  adminUsername: string;
  openPana: string | null;
  closePana: string | null;
  totalStaked: number;
  totalPayout: number;
  net: number;
  agentShare?: number;
  transfer?: number;
  yourResult?: number;
  lines: { typeId: PredictionType; pickedNumber: string; stake: number; agentOdds: number; payout: number }[];
}
interface Resp {
  date: string | null;
  rows: Row[];
}

const FRESH_MS = 5 * 60_000;
// The last look is kept for the life of the page, so coming back to the tab
// shows it again instead of fetching it again.
const cache = new Map<string, { data: Resp; at: number }>();

function Signed({ value }: { value: number }) {
  return (
    <span className="cell-num" style={{ color: value < 0 ? 'var(--danger)' : value > 0 ? 'var(--success)' : undefined }}>
      {value > 0 ? '+' : ''}
      {value.toLocaleString()}
    </span>
  );
}

/**
 * Your position against your Admin, per game, for a day.
 *
 * Profit and loss are shared between you and your Admin by your share (tenths),
 * so when players win it is a loss for both of you:
 *   Whole position — what the day came to between the two of you
 *   You receive    — what the Admin hands over: its slice, which covers what your
 *                    wallet already paid the winners
 *   Your share     — the slice you bear yourself
 * On rows from before shares were applied the Admin carried all of it, so you
 * receive the whole position and bear none.
 */
export function AgentSettlements() {
  const { t } = useLang();
  const [date, setDate] = useState(''); // blank = the latest settled day
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (force = false) => {
      const hit = cache.get(date);
      if (hit && !force && Date.now() - hit.at < FRESH_MS) {
        setData(hit.data);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const d = await call<Resp>('GET', `/predictions/settlements${date ? `?date=${date}` : ''}`);
        cache.set(date, { data: d, at: Date.now() });
        setData(d);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [date],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];
  const shown = date || data?.date || '';
  const received = rows.reduce((s, r) => s + (r.transfer ?? r.net), 0);
  const bear = rows.reduce((s, r) => s + (r.yourResult ?? 0), 0);

  return (
    <>
      <Card
        title="Settlements"
        desc="Your position against your Admin, per game. A win by your players is a loss for both of you; your share of it is shown separately."
        action={<RefreshButton onClick={() => void load(true)} refreshing={loading} />}
      >
        {error && <Alert tone="error">{error}</Alert>}
        <div className="filter-row">
          <Field label="Date">
            <input className="input" type="date" value={shown} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Button onClick={() => setDate('')}>Latest</Button>
          <Button onClick={() => setDate(dayString(0))}>Today</Button>
          <Button onClick={() => setDate(dayString(-1))}>Yesterday</Button>
        </div>
        {rows.length > 0 && (
          <div className="note" style={{ marginTop: 10 }}>
            {date === '' && data?.date ? `Latest settled day: ${data.date}. ` : ''}
            You receive <Signed value={received} /> from your Admin and bear <Signed value={bear} /> yourself, across {rows.length} game{rows.length === 1 ? '' : 's'}.
          </div>
        )}
      </Card>

      {loading && rows.length === 0 ? (
        <Card><Empty>Loading…</Empty></Card>
      ) : rows.length === 0 ? (
        <Card>
          <Empty>Nothing settled{date ? ' on that day' : ' yet'}. A settlement appears once a result is entered for a game your players bet on.</Empty>
        </Card>
      ) : (
        rows.map((r) => {
          const share = r.agentShare ?? 0;
          return (
            <Card
              key={r.id}
              title={`${r.gameName} — ${r.date}`}
              desc={[`vs ${r.adminUsername}`, r.openPana ? `open ${r.openPana}` : null, r.closePana ? `close ${r.closePana}` : null]
                .filter(Boolean)
                .join(' · ')}
              flush
            >
              <div style={{ padding: '0 16px 12px' }}>
                <div className="grid grid--stats">
                  <div className="card stat">
                    <div className="stat__label">Before the split</div>
                    <div className="stat__value"><Signed value={r.net} /></div>
                    <div className="stat__hint">What your Admin would owe if it carried it all (played {Math.abs(r.totalStaked).toLocaleString()}, winnings {Math.abs(r.totalPayout).toLocaleString()})</div>
                  </div>
                  <div className="card stat">
                    <div className="stat__label">You receive</div>
                    <div className="stat__value"><Signed value={r.transfer ?? r.net} /></div>
                    <div className="stat__hint">{share > 0 ? `Your Admin's ${10 - share}/10` : 'The Admin carries all of it'}</div>
                  </div>
                  <div className="card stat">
                    <div className="stat__label">Your share{share > 0 ? ` (${share}/10)` : ''}</div>
                    <div className="stat__value"><Signed value={r.yourResult ?? 0} /></div>
                    <div className="stat__hint">{share > 0 ? 'What you bear yourself' : 'None on this settlement'}</div>
                  </div>
                </div>
              </div>

              {r.lines.length === 0 ? (
                <Empty>No winning numbers — the whole day's stake stands.</Empty>
              ) : (
                <TableWrap>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Winning number</th>
                      <th style={{ textAlign: 'right' }}>Staked on it</th>
                      <th style={{ textAlign: 'right' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lines.map((l) => (
                      <tr key={`${l.typeId}-${l.pickedNumber}`}>
                        <td>{predictionTypeLabel(t, l.typeId)}</td>
                        <td className="cell-strong cell-num">{l.pickedNumber}</td>
                        <td className="cell-num" style={{ textAlign: 'right' }}>{l.stake.toLocaleString()}</td>
                        <td className="cell-num" style={{ textAlign: 'right' }}>{l.agentOdds}x</td>
                        <td style={{ textAlign: 'right' }}><Signed value={l.payout} /></td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </Card>
          );
        })
      )}
    </>
  );
}
