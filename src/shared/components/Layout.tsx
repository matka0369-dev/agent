import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { LANGUAGES, useLang } from '../lib/i18n';
import { ACCOUNT_TYPE_LABEL, PORTALS } from '../lib/types';
import { Button } from './ui';
import { TabContext } from './tab-context';

// How often the header re-reads a Player's own balance. Independent of
// whatever any given tab is doing — the header persists across tab
// switches, so it polls on its own rather than relying on some other
// component's fetch to keep it current.
const PURSE_POLL_MS = 20_000;

export type NavItem = { id: string; label: string };

export function Layout({
  title,
  subtitle,
  nav,
  children,
  activeId: controlledActiveId,
  onSelectTab,
}: {
  /** Omit (or pass '') to skip the page header entirely — a tab whose own
   *  content already carries its heading (e.g. Player's Predict, which
   *  shows each game's own name/schedule) doesn't need "Welcome, x" above it
   *  too. */
  title?: string;
  subtitle?: string;
  /**
   * Tabs — each id must match a <Section id="…"> among children. Only the
   * active tab's Section actually mounts (via TabContext); every other
   * Section renders nothing at all, so a section's own data-fetching
   * (LedgerCard, RatesSection, MySessionsCard, …) never fires until its tab
   * is opened, instead of every section on the page firing its fetch at once
   * on load.
   */
  nav?: NavItem[];
  children: ReactNode;
  /**
   * Controlled mode: pass both this and `onSelectTab` to drive which tab is
   * active from outside (e.g. a router's current path) instead of Layout's
   * own click-to-switch state. Omit both for the default, uncontrolled
   * behavior every existing caller uses.
   */
  activeId?: string;
  onSelectTab?: (id: string) => void;
}) {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [internalActiveId, setInternalActiveId] = useState<string | undefined>(nav?.[0]?.id);
  const activeId = controlledActiveId ?? internalActiveId;
  // Spendable total only — the same figure PredictForm bets against (main
  // wallet first, then winnings). Only a Player has a personal purse to show
  // here; every other tier's "balance" is subtree accounting, not a wallet.
  const [purse, setPurse] = useState<number | null>(null);

  useEffect(() => {
    if (!user || user.accountType !== 'PLAYER') return;
    let cancelled = false;
    const load = async () => {
      try {
        const me = await api.getUser(user.id);
        if (!cancelled) setPurse(me.balance + me.winningsBalance);
      } catch {
        // Transient — the header just keeps showing the last known figure.
      }
    };
    void load();
    const timer = setInterval(() => void load(), PURSE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  // If `nav` changes shape (a permission-gated tab appears/disappears) and
  // the currently active id is no longer in it, fall back to the first tab
  // rather than rendering a blank panel with no tab visibly selected.
  const resolvedActiveId = nav?.some((item) => item.id === activeId) ? activeId : nav?.[0]?.id;

  // Keep the page behind the open mobile drawer from scrolling too, and let
  // Escape close it like any other overlay.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  if (!user) return null;

  function selectTab(id: string) {
    if (onSelectTab) onSelectTab(id);
    else setInternalActiveId(id);
    setMenuOpen(false);
  }

  return (
    <div className="shell" data-role={user.accountType}>
      <header className="topbar">
        {nav && nav.length > 0 && (
          <button
            type="button"
            className="topbar__menu-btn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="topbar__menu-icon" data-open={menuOpen} />
          </button>
        )}
        <div className="topbar__mark">P</div>
        <span className="topbar__title">
          PredictSim
          {/* Every other tier is staff — worth reminding them which console
              they're in. A Player is a player website's actual audience,
              and being told that on every screen adds nothing for them. */}
          {user.accountType !== 'PLAYER' && (
            <span className="topbar__portal">{PORTALS[user.accountType].name}</span>
          )}
        </span>
        <div className="topbar__spacer" />
        <div className="topbar__who">
          {user.accountType === 'PLAYER' && (
            <>
              {purse !== null && (
                <span className="topbar__purse" title={t('header.purseTitle', 'Spendable balance')}>
                  👛 {purse.toLocaleString()}
                </span>
              )}
              <select
                className="topbar__lang-select"
                aria-label={t('header.language', 'Language')}
                value={lang}
                onChange={(e) => setLang(e.target.value as (typeof LANGUAGES)[number]['code'])}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <span className="badge">{ACCOUNT_TYPE_LABEL[user.accountType]}</span>
          <span className="topbar__user">{user.username}</span>
          {/* Hidden below the sidebar's mobile breakpoint — the drawer's own
              copy (right below) takes over there instead of this row
              overflowing. Both render always; CSS picks one. */}
          <span className="topbar__signout">
            <Button size="sm" onClick={() => void logout()}>
              {t('header.signOut', 'Sign out')}
            </Button>
          </span>
        </div>
      </header>

      <div className="body">
        {nav && nav.length > 0 && (
          <>
            {menuOpen && <div className="sidebar__backdrop" onClick={() => setMenuOpen(false)} />}
            <nav
              className={menuOpen ? 'sidebar sidebar--open' : 'sidebar'}
              aria-label="Section navigation"
            >
              <div className="sidebar__list" role="tablist" aria-orientation="vertical">
                {nav.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={resolvedActiveId === item.id}
                    className={
                      resolvedActiveId === item.id
                        ? 'sidebar__link sidebar__link--active'
                        : 'sidebar__link'
                    }
                    onClick={() => selectTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Only shown on the same narrow screens the drawer itself is
                  for — see .sidebar__signout in styles.css — since that's
                  exactly where the header no longer has room for it. */}
              <div className="sidebar__signout">
                <Button size="sm" style={{ width: '100%' }} onClick={() => void logout()}>
                  {t('header.signOut', 'Sign out')}
                </Button>
              </div>
            </nav>
          </>
        )}

        <main className="page">
          {title && (
            <div className="page__head">
              <h1>{title}</h1>
              {subtitle && <div className="page__sub">{subtitle}</div>}
            </div>
          )}
          <div className="grid">
            <TabContext.Provider value={resolvedActiveId}>{children}</TabContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}
