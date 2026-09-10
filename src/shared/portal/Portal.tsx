import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { AccountType } from '../lib/types';
import { ACCOUNT_TYPE_LABEL, PORTALS } from '../lib/types';
import { Alert, Button, Card } from '../components/ui';
import { LoginPage } from './LoginPage';

/**
 * Gate for a single-role app. Each portal serves exactly one account type;
 * anything else is turned away rather than rendered.
 *
 * This is presentation, not security — every API call is authorised
 * server-side regardless of which portal issued it. What this actually
 * prevents is confusion: browser cookies are scoped by host and ignore port,
 * so all four dev portals share one session. Signing in here signs you in
 * everywhere, and without this guard the Player portal would happily render
 * an empty Player dashboard for an Admin account.
 */
export function Portal({
  accountTypes,
  children,
}: {
  /**
   * Every account type allowed into this portal. A tier's own staff account
   * (e.g. ADMIN_STAFF) shares its creator's portal rather than getting one
   * of its own — pass both, e.g. `['ADMIN', 'ADMIN_STAFF']`.
   */
  accountTypes: AccountType[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  // The login screen only needs one accent color; the first listed type's
  // role color represents this portal.
  const primaryAccountType = accountTypes[0];

  if (loading) {
    return (
      <div className="login" data-role={primaryAccountType}>
        <span className="note">Loading…</span>
      </div>
    );
  }

  if (!user) return <LoginPage accountType={primaryAccountType} />;
  if (!accountTypes.includes(user.accountType)) return <WrongPortal actual={user.accountType} />;

  return <>{children}</>;
}

function WrongPortal({ actual }: { actual: AccountType }) {
  const { user, logout } = useAuth();
  const target = PORTALS[actual];
  const href = `http://${window.location.hostname}:${target.devPort}`;

  return (
    <div className="login" data-role={actual}>
      <div className="login__box">
        <div className="login__brand">
          <div className="login__mark">P</div>
          <h1>PredictSim</h1>
        </div>

        <Card title="Wrong portal">
          <Alert tone="info">
            <strong>{user?.username}</strong> is a {ACCOUNT_TYPE_LABEL[actual]} account, and this
            portal only serves a different tier.
          </Alert>
          <p className="note">
            Sessions are shared across all portals on this host, so you're already signed in — open
            the {target.name} portal to continue.
          </p>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <a className="btn btn--primary" href={href}>
              Go to {target.name} portal
            </a>
            <Button onClick={() => void logout()}>Sign out</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
