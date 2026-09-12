import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Turns a `Layout`'s tab nav into real URLs: `homeId`'s tab lives at "/",
 * every other tab at "/" + id. Pass the result as `Layout`'s `activeId` /
 * `onSelectTab` (controlled mode) so the sidebar highlight follows the
 * browser's URL instead of Layout's own internal click state.
 *
 * Only the URL's first path segment is read, so a tab that owns a nested
 * detail route (e.g. "admins" also serving "/admins/:id") still resolves to
 * that same tab being active — see PredictForm's "/" + "/predict/:gameId"
 * for the pattern this generalizes.
 */
export function useRoutedTabs(homeId: string) {
  const location = useLocation();
  const navigate = useNavigate();

  const segment = location.pathname.split('/')[1] ?? '';
  const activeId = segment === '' ? homeId : segment;

  function onSelectTab(id: string) {
    navigate(id === homeId ? '/' : `/${id}`);
  }

  return { activeId, onSelectTab };
}
