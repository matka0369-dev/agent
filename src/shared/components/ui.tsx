import type { ReactNode } from 'react';
import { ACCOUNT_TYPE_LABEL, type AccountType } from '../lib/types';
import { useActiveTab } from './tab-context';

export function Card({
  title,
  desc,
  action,
  flush,
  children,
}: {
  title?: string;
  desc?: string;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {title && (
        <header className="card__head">
          <div className="card__head-text">
            <h2>{title}</h2>
            {desc && <div className="card__desc">{desc}</div>}
          </div>
          {action && (
            <>
              <div style={{ flex: 1 }} />
              {action}
            </>
          )}
        </header>
      )}
      <div className={flush ? 'card__body card__body--flush' : 'card__body'}>{children}</div>
    </section>
  );
}

/**
 * One tab panel of a dashboard page, paired with a `Layout`'s `nav` by id.
 * Reads the active tab from context (set by `Layout`) and renders nothing
 * at all — not hidden via CSS, genuinely unmounted — when it isn't the
 * selected one. That's what keeps a section's own data-fetching
 * (`LedgerCard`, `RatesSection`, `MySessionsCard`, …) from firing until its
 * tab is actually opened, rather than every section on the page fetching at
 * once on load.
 *
 * Outside any tab system (a `Layout` with no `nav`), the context value is
 * `undefined` and `Section` renders unconditionally — this stays usable as
 * a plain wrapper for anyone who doesn't want tabs.
 */
export function Section({ id, children }: { id: string; children: ReactNode }) {
  const activeTab = useActiveTab();
  if (activeTab !== undefined && activeTab !== id) return null;
  return (
    <div id={id} className="section-anchor" role={activeTab !== undefined ? 'tabpanel' : undefined}>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <section className="card stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </section>
  );
}

export function Field({
  label,
  hint,
  hintTone,
  children,
}: {
  label: string;
  hint?: ReactNode;
  hintTone?: 'ok' | 'bad';
  children: ReactNode;
}) {
  const hintClass = hintTone ? `field__hint field__hint--${hintTone}` : 'field__hint';
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className={hintClass}>{hint}</span>}
    </label>
  );
}

export function Button({
  variant = 'ghost',
  size,
  type = 'button',
  ...rest
}: {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = ['btn', `btn--${variant}`, size ? `btn--${size}` : ''].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}

export function RoleBadge({ type }: { type: AccountType }) {
  return (
    <span className="badge badge--muted">
      <span className={`dot dot--${type}`} />
      {ACCOUNT_TYPE_LABEL[type]}
    </span>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={active ? 'badge badge--ok' : 'badge badge--off'}>
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  return <div className={`alert alert--${tone}`}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="table">{children}</table>
    </div>
  );
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** Trims noisy UA strings down to something readable in a table cell. */
export function shortUserAgent(ua: string | null) {
  if (!ua) return 'Unknown device';
  if (ua.startsWith('curl/')) return ua;
  const browser = /(Firefox|Edg|Chrome|Safari)\/[\d.]+/.exec(ua)?.[0];
  return browser ?? `${ua.slice(0, 40)}…`;
}
