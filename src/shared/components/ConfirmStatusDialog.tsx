import { useEffect, useState } from 'react';
import { ACCOUNT_TYPE_LABEL, type StatusImpact } from '../lib/types';
import { Alert, Button } from './ui';

/**
 * Confirmation for enabling/disabling an account.
 *
 * Disabling cascades through the whole subtree and cuts live sessions, so the
 * confirmation is proportionate to that: the real blast radius up front, then
 * the username typed out by hand. A second button would only prove the mouse
 * moved twice. Re-enabling is restorative and reversible, so it asks once.
 */
export function ConfirmStatusDialog({
  impact,
  busy,
  onCancel,
  onConfirm,
}: {
  impact: StatusImpact;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const disabling = !impact.nextIsActive;
  const canConfirm = !busy && (!disabling || typed === impact.username);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  const breakdown = Object.entries(impact.affectedByType) as [
    keyof typeof impact.affectedByType,
    number,
  ][];

  return (
    <div className="modal__backdrop" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={disabling ? 'Confirm disable account' : 'Confirm enable account'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <h2>{disabling ? 'Disable' : 'Enable'} {impact.username}?</h2>
          <div className="card__desc">
            {ACCOUNT_TYPE_LABEL[impact.accountType]} account
          </div>
        </header>

        <div className="modal__body">
          {disabling ? (
            <>
              <Alert tone="error">
                This signs out <strong>{impact.username}</strong> immediately and takes every
                account beneath them down too. Nobody in this subtree will be able to log in.
              </Alert>

              <ul className="impact-list">
                <li>
                  <strong>{impact.affectedCount}</strong> account
                  {impact.affectedCount === 1 ? '' : 's'} beneath them will be disabled
                </li>
                <li>
                  <strong>{impact.sessionsToRevoke}</strong> active session
                  {impact.sessionsToRevoke === 1 ? '' : 's'} will be revoked
                </li>
              </ul>

              {breakdown.length > 0 && (
                <div className="note" style={{ marginTop: 10 }}>
                  {breakdown
                    .map(([type, count]) => `${count} × ${ACCOUNT_TYPE_LABEL[type]}`)
                    .join(' · ')}
                </div>
              )}

              <label className="field" style={{ marginTop: 16 }}>
                <span className="field__label">
                  Type <strong>{impact.username}</strong> to confirm
                </span>
                <input
                  className="input"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </>
          ) : (
            <>
              <Alert tone="info">
                <strong>{impact.username}</strong> will be able to log in again.
              </Alert>
              <ul className="impact-list">
                <li>
                  <strong>{impact.affectedCount}</strong> account
                  {impact.affectedCount === 1 ? '' : 's'} disabled by this cascade will be restored
                </li>
              </ul>
              <div className="note" style={{ marginTop: 10 }}>
                Accounts that were already disabled on their own before this cascade stay disabled.
              </div>
            </>
          )}
        </div>

        <footer className="modal__foot">
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={disabling ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {busy
              ? 'Working…'
              : disabling
                ? `Disable ${impact.affectedCount + 1} account${impact.affectedCount === 0 ? '' : 's'}`
                : 'Enable'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
