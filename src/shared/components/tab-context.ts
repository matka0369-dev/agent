import { createContext, useContext } from 'react';

/**
 * The active tab id, provided by `Layout` and read by `Section`. `undefined`
 * means "no tab system" (the `Layout` this `Section` lives in has no `nav`
 * at all) — in that case `Section` renders unconditionally, so this stays
 * backward compatible with any caller that doesn't want tabs.
 *
 * Split into its own module so `Layout.tsx` and `ui.tsx` can both import it
 * without importing each other — `Layout` already imports `Button` from
 * `ui.tsx`, so the reverse import would be circular.
 */
export const TabContext = createContext<string | undefined>(undefined);

export function useActiveTab(): string | undefined {
  return useContext(TabContext);
}
