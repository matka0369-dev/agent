import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ACCOUNT_TYPE_LABEL, PORTALS } from '../lib/types';
import { Button } from './ui';
import { TabContext } from './tab-context';

export type NavItem = { id: string; label: string };

export function Layout({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
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
}) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | undefined>(nav?.[0]?.id);

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
    setActiveId(id);
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
          PredictSim <span className="topbar__portal">{PORTALS[user.accountType].name}</span>
        </span>
        <div className="topbar__spacer" />
        <div className="topbar__who">
          <span className="badge">{ACCOUNT_TYPE_LABEL[user.accountType]}</span>
          <span className="topbar__user">{user.username}</span>
          <Button size="sm" onClick={() => void logout()}>
            Sign out
          </Button>
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
            </nav>
          </>
        )}

        <main className="page">
          <div className="page__head">
            <h1>{title}</h1>
            {subtitle && <div className="page__sub">{subtitle}</div>}
          </div>
          <div className="grid">
            <TabContext.Provider value={resolvedActiveId}>{children}</TabContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}
