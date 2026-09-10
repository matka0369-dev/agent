import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { AccountType } from '../lib/types';
import { PORTALS } from '../lib/types';
import { Alert, Button, Card, Field } from '../components/ui';

/**
 * Shared across all four portals — `accountType` only changes the branding
 * and accent. The server has no concept of "which portal": credentials for
 * any account will authenticate here, and `Portal` is what redirects you to
 * the right one afterwards.
 */
export function LoginPage({ accountType }: { accountType: AccountType }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Players are issued a username rather than an email address, so that's what
  // their portal asks for. The server accepts either from any portal.
  const isPlayer = accountType === 'PLAYER';

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
        <p className="login__tagline">{PORTALS[accountType].name} portal</p>

        <Card>
          <form onSubmit={submit}>
            {error && <Alert tone="error">{error}</Alert>}
            <Field label={isPlayer ? 'Username' : 'Email or username'}>
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
            <Field label="Password">
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
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <div className="login__foot">
          <span className="note">
            Accounts are created by an administrator — there is no self sign-up.
          </span>
        </div>
      </div>
    </div>
  );
}
