import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { AccountType } from '../lib/types';
import { PORTALS } from '../lib/types';
import { Alert, Button, Card, Field } from '../components/ui';
import { LANGUAGES, useLang } from '../lib/i18n';

/**
 * Shared across all four portals — `accountType` only changes the branding
 * and accent. The server has no concept of "which portal": credentials for
 * any account will authenticate here, and `Portal` is what redirects you to
 * the right one afterwards.
 *
 * The Player portal alone gets a language step first (see `useLang` — only
 * that app has a `LangProvider` in its tree; everywhere else `t()` is a
 * no-op passthrough, so this renders identically to before for staff).
 */
export function LoginPage({ accountType }: { accountType: AccountType }) {
  const { login } = useAuth();
  const { lang, setLang, t } = useLang();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Players are issued a username rather than an email address, so that's what
  // their portal asks for. The server accepts either from any portal.
  const isPlayer = accountType === 'PLAYER';
  // Only the Player portal is localized, so only it needs the extra step —
  // every other portal goes straight to credentials, same as always.
  const [step, setStep] = useState<'language' | 'credentials'>(isPlayer ? 'language' : 'credentials');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(identifier, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login" data-role={accountType}>
      <div className="login__box">
        <div className="login__brand">
          <div className="login__mark">P</div>
          <h1>PredictSim</h1>
        </div>
        {/* A Player is this product's actual audience — telling them
            they're on "the Player portal" reads as an internal label
            leaking through. Every other tier is staff, for whom naming the
            console they're in is useful. */}
        {accountType !== 'PLAYER' && (
          <p className="login__tagline">{PORTALS[accountType].name} portal</p>
        )}

        {step === 'language' ? (
          <Card title={t('lang.title')} desc={t('lang.subtitle')}>
            <div className="type-chip-row" style={{ marginBottom: 14 }}>
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={`type-chip${lang === l.code ? ' type-chip--selected' : ''}`}
                  onClick={() => setLang(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="primary"
              style={{ width: '100%' }}
              onClick={() => setStep('credentials')}
            >
              {t('lang.continue')}
            </Button>
          </Card>
        ) : (
          <Card>
            <form onSubmit={submit}>
              {error && <Alert tone="error">{error}</Alert>}
              <Field label={isPlayer ? t('login.usernameLabel') : 'Email or username'}>
                <input
                  className="input"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </Field>
              <Field label={isPlayer ? t('login.passwordLabel') : 'Password'}>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Field>
              <Button type="submit" variant="primary" disabled={busy} style={{ width: '100%' }}>
                {busy ? t('login.signingIn') : t('login.signIn')}
              </Button>
              {isPlayer && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={() => setStep('language')}
                >
                  ← {t('login.back')}
                </button>
              )}
            </form>
          </Card>
        )}

        <div className="login__foot">
          <span className="note">
            {isPlayer
              ? t('login.noSelfSignup')
              : 'Accounts are created by an administrator — there is no self sign-up.'}
          </span>
        </div>
      </div>
    </div>
  );
}
