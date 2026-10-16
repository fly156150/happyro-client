/** Ordinary menu fields use shared styling; compound controls own their segments. */
export function createMenuField(tag = 'input', role = 'field') {
 const field = document.createElement(tag);
 field.dataset.menuControl = role;
 return field;
}
