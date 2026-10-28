/** Keep the portrait scope switch beside the action buttons. */
export function createAdventureScopeLayout(content, host) {
 const scopes = new WeakMap();
 const sync = () => {
  const tab = content.firstElementChild;
  if (!tab?.matches('.game-tools-tab')) return;
  const toolbar = tab.querySelector('.monster-toolbar, .catalog-toolbar');
  if (!toolbar) return;
  const portrait = host.hasAttribute('data-phone-screen') && host.dataset.orientation === 'portrait';
  let scope = scopes.get(tab) || toolbar.querySelector('.catalog-scope-option');
  if (!scope) return;
  scopes.set(tab, scope);
  const actions = portrait && tab.querySelector('.summon-panel, .catalog-action-panel');
  const parent = actions || toolbar;
  if (scope.parentElement === parent) return;
  if (actions) actions.prepend(scope);
  else toolbar.append(scope);
 };
 const contentObserver = new MutationObserver(sync);
 contentObserver.observe(content, { childList: true, subtree: true });
 const layoutObserver = new MutationObserver(sync);
 layoutObserver.observe(host, { attributes: true, attributeFilter: ['data-phone-screen', 'data-orientation'] });
 sync();
 return () => {
  contentObserver.disconnect();
  layoutObserver.disconnect();
 };
}
