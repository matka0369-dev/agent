import { useEffect, useMemo, useState } from 'react';
import type { BetType, RateEntry, RateMeta } from '../lib/types';
import { Alert, Button, Card, Empty, TableWrap } from './ui';

/**
 * One rate card. Serves every variant in the app:
 *
 * - an Admin's DEFAULT template (editable)
 * - an Agent's GIVING card (editable)
 * - an Agent's GIVEN card, and a Player's effective rates (read-only)
 *
 * Had a `caps` prop that rendered a "Max" column and blocked saving a rate
 * above the tier above's — removed 2026-08-05 along with the server-side
 * cap it mirrored, since an Agent may now deliberately give more than it
 * was given and carry the difference. The only remaining per-row rule is
 * that a multiplier is a whole number of at least 1.
 */
export function RateCard({
  title,
  desc,
  entries,
  meta,
  editable,
  onSave,
}: {
  title: string;
  desc?: string;
  entries: RateEntry[];
  meta: RateMeta | null;
  editable?: boolean;
  onSave?: (changed: { betType: BetType; multiplier: number }[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  // Re-seed whenever the saved card changes, so an external update (or our
  // own successful save) becomes the new baseline rather than leaving the
  // inputs showing stale edits.
  useEffect(() => {
    setDraft(Object.fromEntries(entries.map((e) => [e.betType, String(e.multiplier)])));
  }, [entries]);

  const labelFor = useMemo(() => {
    const map = new Map(meta?.betTypes.map((b) => [b.betType, b.label]));
    return (betType: BetType) => map.get(betType) ?? betType;
  }, [meta]);

  const rowState = entries.map((entry) => {
    const raw = draft[entry.betType] ?? String(entry.multiplier);
    const parsed = Number(raw);
    const valid = raw.trim() !== '' && Number.isInteger(parsed) && parsed >= 1;
    return { entry, raw, parsed, valid, dirty: valid && parsed !== entry.multiplier };
  });

  const invalid = rowState.some((r) => !r.valid);
  const changed = rowState.filter((r) => r.dirty);

  async function save() {
    if (!onSave || changed.length === 0) return;
    setBusy(true);
    setError(null);
    setOkMessage(null);
    try {
      await onSave(changed.map((r) => ({ betType: r.entry.betType, multiplier: r.parsed })));
      setOkMessage(`Updated ${changed.length} rate${changed.length === 1 ? '' : 's'}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (entries.length === 0) {
    return (
      <Card title={title} desc={desc}>
        <Empty>No rate card yet.</Empty>
      </Card>
    );
  }

  return (
    <Card title={title} desc={desc} flush>
      {(error || okMessage) && (
        <div style={{ padding: '16px 16px 0' }}>
          {error && <Alert tone="error">{error}</Alert>}
          {okMessage && !error && <Alert tone="success">{okMessage}</Alert>}
        </div>
      )}

      <TableWrap>
        <thead>
          <tr>
            <th>Bet type</th>
            <th style={{ textAlign: 'right' }}>Multiplier</th>
          </tr>
        </thead>
        <tbody>
          {rowState.map(({ entry, raw, valid }) => (
            <tr key={entry.betType}>
              <td className="cell-strong">{labelFor(entry.betType)}</td>
              <td style={{ textAlign: 'right' }}>
                {editable ? (
                  <input
                    className="input input--rate"
                    inputMode="numeric"
                    value={raw}
                    aria-label={`${labelFor(entry.betType)} multiplier`}
                    aria-invalid={!valid}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [entry.betType]: e.target.value }))
                    }
                  />
                ) : (
                  <span className="cell-num">{entry.multiplier}x</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      {editable && (
        <div className="card__foot">
          {invalid && (
            <span className="note note--bad">
              Every multiplier must be a whole number of at least 1.
            </span>
          )}
          {!invalid && changed.length > 0 && (
            <span className="note">
              {changed.length} unsaved change{changed.length === 1 ? '' : 's'}
            </span>
          )}
          <div style={{ flex: 1 }} />
          <Button
            variant="primary"
            disabled={busy || invalid || changed.length === 0}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : 'Save rates'}
          </Button>
        </div>
      )}
    </Card>
  );
}
