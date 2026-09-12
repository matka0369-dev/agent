import { Fragment, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Game } from '../lib/types';
import { Alert, Button, Card, Empty, Field, RefreshButton, TableWrap, formatDate } from './ui';

const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function StatusBadgeFor({ status }: { status: Game['status'] }) {
  const cls = status === 'ACTIVE' ? 'badge--ok' : status === 'ARCHIVED' ? 'badge--off' : 'badge--muted';
  return <span className={`badge ${cls}`}>{status}</span>;
}

// Platform Admin's game management surface: create games, flip
// DRAFT<->ACTIVE (ARCHIVED is a one-way door — see GamesService.update),
// and manage each game's leave days. Enabling a game for a specific Admin's
// subtree is a separate action, owned by that Admin (GameEnablementCard).
export function GamesManagementCard() {
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGames(await api.listGamesAsPlatformAdmin());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: string, status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED') {
    try {
      await api.updateGame(id, { status });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  return (
    <>
      <CreateGameForm onCreated={() => void load()} />

      <Card
        title="Games"
        desc="Every game, its schedule, and its leave days."
        flush
        action={<RefreshButton onClick={() => void load()} refreshing={loading} />}
      >
        {error && (
          <div style={{ padding: '16px 16px 0' }}>
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {loading ? (
          <Empty>Loading…</Empty>
        ) : games.length === 0 ? (
          <Empty>No games yet.</Empty>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Open</th>
                <th>Close</th>
                <th>Weekly off</th>
                <th style={{ textAlign: 'right' }}>Stake range</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <Fragment key={g.id}>
                  <tr>
                    <td className="cell-strong">{g.name}</td>
                    <td>
                      <StatusBadgeFor status={g.status} />
                    </td>
                    <td className="cell-num">{g.openTime}</td>
                    <td className="cell-num">{g.closeTime}</td>
                    <td className="cell-muted">
                      {g.weeklyOffDays.length === 0
                        ? '—'
                        : g.weeklyOffDays.map((d) => WEEKDAY_LABEL[d]).join(', ')}
                    </td>
                    <td className="cell-num" style={{ textAlign: 'right' }}>
                      {g.minStake}–{g.maxStake}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {g.status === 'DRAFT' && (
                          <Button size="sm" variant="primary" onClick={() => void setStatus(g.id, 'ACTIVE')}>
                            Activate
                          </Button>
                        )}
                        {g.status === 'ACTIVE' && (
                          <Button size="sm" onClick={() => void setStatus(g.id, 'DRAFT')}>
                            Move to draft
                          </Button>
                        )}
                        {g.status !== 'ARCHIVED' && (
                          <Button size="sm" variant="danger" onClick={() => void setStatus(g.id, 'ARCHIVED')}>
                            Archive
                          </Button>
                        )}
                        <Button size="sm" onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}>
                          {expandedId === g.id ? 'Hide leave days' : 'Leave days'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === g.id && (
                    <tr>
                      <td colSpan={7} style={{ background: 'var(--surface-2)' }}>
                        <HolidaysEditor game={g} onChanged={() => void load()} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </>
  );
}

function HolidaysEditor({ game, onChanged }: { game: Game; onChanged: () => void }) {
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.addGameHoliday(game.id, date, reason.trim() || undefined);
      setDate('');
      setReason('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(holidayDate: string) {
    try {
      await api.removeGameHoliday(game.id, holidayDate.slice(0, 10));
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }

  return (
    <div style={{ padding: '12px 4px' }}>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={add} className="form-row" style={{ alignItems: 'flex-end' }}>
        <Field label="Date">
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </Field>
        <Field label="Reason (optional)">
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Holiday"
          />
        </Field>
        <Button type="submit" variant="primary" disabled={submitting || !date}>
          Add leave day
        </Button>
      </form>

      {game.holidays.length === 0 ? (
        <div className="note">No leave days configured — this game runs every day it isn't a weekly off day.</div>
      ) : (
        <div className="checkbox-list">
          {game.holidays.map((h) => (
            <div key={h.id} className="checkbox-list__item" style={{ justifyContent: 'space-between' }}>
              <span>
                {formatDate(h.date).split(',')[0]}
                {h.reason ? ` — ${h.reason}` : ''}
              </span>
              <Button size="sm" variant="danger" onClick={() => void remove(h.date)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateGameForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [openTime, setOpenTime] = useState('10:00');
  const [closeTime, setCloseTime] = useState('18:00');
  // The zone the two clock times below are read in, and that this game's
  // rounds are dated by. Defaults to the platform's market zone; the server
  // applies the same default when the field is omitted.
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [weeklyOffDays, setWeeklyOffDays] = useState<Set<number>>(new Set());
  const [minStake, setMinStake] = useState('10');
  const [maxStake, setMaxStake] = useState('10000');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleDay(d: number) {
    setWeeklyOffDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOkMessage(null);
    try {
      const created = await api.createGame({
        name,
        description: description.trim() || undefined,
        openTime,
        closeTime,
        timezone,
        weeklyOffDays: [...weeklyOffDays],
        minStake: Number(minStake),
        maxStake: Number(maxStake),
      });
      setOkMessage(`Created ${created.name} as a draft — activate it once it's ready.`);
      setName('');
      setDescription('');
      setWeeklyOffDays(new Set());
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="Create a game" desc="A recurring daily open/close time, entered once.">
      <form onSubmit={submit}>
        {error && <Alert tone="error">{error}</Alert>}
        {okMessage && <Alert tone="success">{okMessage}</Alert>}

        <div className="form-row">
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Description (optional)">
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        <div className="form-row">
          <Field label="Open time">
            <input
              className="input"
              type="time"
              value={openTime}
              onChange={(e) => setOpenTime(e.target.value)}
              required
            />
          </Field>
          <Field label="Close time">
            <input
              className="input"
              type="time"
              value={closeTime}
              onChange={(e) => setCloseTime(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field
          label="Timezone"
          hint="Open/close times and this game's betting day are read in this zone."
        >
          <input
            className="input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Asia/Kolkata"
            required
          />
        </Field>

        <Field label="Weekly off days" hint="Leave none selected for a game that runs every day.">
          <div className="checkbox-list" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {WEEKDAY_LABEL.map((label, d) => (
              <label key={d} className="checkbox-list__item">
                <input type="checkbox" checked={weeklyOffDays.has(d)} onChange={() => toggleDay(d)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="form-row">
          <Field label="Min stake">
            <input
              className="input"
              inputMode="numeric"
              value={minStake}
              onChange={(e) => setMinStake(e.target.value)}
              required
            />
          </Field>
          <Field label="Max stake">
            <input
              className="input"
              inputMode="numeric"
              value={maxStake}
              onChange={(e) => setMaxStake(e.target.value)}
              required
            />
          </Field>
        </div>

        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create game'}
        </Button>
      </form>
    </Card>
  );
}
