import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { MyRates, RateMeta } from '../lib/types';
import { RateCard } from './RateCard';
import { Alert, Card } from './ui';

/**
 * The signed-in account's rate cards, shaped by tier. Self-contained (fetches
 * its own data) because all four dashboards want the same block and none of
 * them should have to know the card layout for a tier they aren't.
 */
export function RatesSection() {
  const [meta, setMeta] = useState<RateMeta | null>(null);
  const [rates, setRates] = useState<MyRates | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([api.rateMeta(), api.myRates()]);
      setMeta(m);
      setRates(r);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!rates) return <Card title="Rates"><div className="note">Loading…</div></Card>;

  if (rates.kind === 'ADMIN') {
    return (
      <>
        <RateCard
          title="Your default rate card"
          desc="The template handed to every Agent you create from here on. Existing Agents keep the rates they were given."
          entries={rates.default}
          meta={meta}
          editable
          onSave={async (entries) => {
            await api.updateDefaultRates(entries);
            await load();
          }}
        />
      </>
    );
  }

  if (rates.kind === 'AGENT') {
    return (
      <>
        <RateCard
          title="Given to you"
          desc="Set by your Admin when your account was created. Read-only — what the Admin pays you at."
          entries={rates.given}
          meta={meta}
        />
        {/* No `caps` any more: an Agent may give more than it was given and
            absorb the difference itself on a win — see the giving-cap
            revision (2026-08-05) in ARCHITECTURE.md. */}
        <RateCard
          title="What you give"
          desc="What your players actually play at. Below what you were given keeps you a margin; above it, you cover the difference yourself on a win."
          entries={rates.giving}
          meta={meta}
          editable
          onSave={async (entries) => {
            await api.updateGivingRates(entries);
            await load();
          }}
        />
      </>
    );
  }

  return (
    <RateCard
      title="Your rates"
      desc="The payout multipliers you play at, set by your agent."
      entries={rates.playing}
      meta={meta}
    />
  );
}
