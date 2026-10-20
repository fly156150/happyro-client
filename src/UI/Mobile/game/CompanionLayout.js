/** Shared touch presentation for pets, homunculi and mercenaries. */
export function createCompanionLayout(
	body,
	{ nameAttribute, nameLabel, sectionTitle, contentAttribute, refresh = false }
) {
	body.innerHTML = `<div class="companion-layout">
  <section class="companion-info"><h3>状态</h3><dl data-info></dl></section>
  <section class="companion-content">${sectionTitle ? `<h3>${sectionTitle}</h3>` : ''}<div ${contentAttribute}></div></section>
 </div><div class="companion-footer menu-footer">
  <label class="companion-name menu-form-row"><input data-menu-control="field" ${nameAttribute} maxlength="23" aria-label="${nameLabel}" placeholder="${nameLabel}"></label>
  <div class="inventory-actions menu-action-group" data-actions>${refresh ? '<button type="button" data-refresh>刷新状态</button>' : ''}</div>
 </div>`;
}
