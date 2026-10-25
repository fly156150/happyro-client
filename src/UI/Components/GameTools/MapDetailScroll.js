/** Keep wheel input inside the map detail, transferring NPC overflow to its parent. */
export function bindMapDetailScroll(body) {
 const npcList = body.querySelector('.map-npc-scroll');
 const jump = body.querySelector('.map-monsters-jump');
 const monsters = body.querySelector('.map-monsters');
 function consume(node, delta) {
  const before = node.scrollTop;
  node.scrollTop = Math.max(0, Math.min(before + delta, node.scrollHeight - node.clientHeight));
  return delta - (node.scrollTop - before);
 }
 body.addEventListener('wheel', event => {
  if (event.ctrlKey || !event.deltaY) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? body.clientHeight : 1;
  let remaining = event.deltaY * unit;
  if (npcList?.contains(event.target)) remaining = consume(npcList, remaining);
  consume(body, remaining);
  event.preventDefault();
  event.stopPropagation();
 }, {passive: false});
 jump.addEventListener('click', () => {
  if (jump.disabled) return;
  const top = body.scrollTop + monsters.getBoundingClientRect().top - body.getBoundingClientRect().top;
  body.scrollTo({top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
 });
}
