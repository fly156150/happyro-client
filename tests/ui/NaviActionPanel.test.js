import { afterEach, expect, it, vi } from 'vitest';
import { showNaviActionPanel, clearNaviActionPanel } from '../../src/UI/Components/Navigation/NaviActionPanel.js';
afterEach(clearNaviActionPanel);
it('keeps an explicit retry available without closing or advancing the NPC dialogue', () => {
 const retry=vi.fn(),dismiss=vi.fn(),viewMap=vi.fn();
 showNaviActionPanel({title:'<目标>',message:'先结束对话',retry,viewMap,onDismiss:dismiss});
 const panel=document.querySelector('.navi-action-panel'),root=panel.shadowRoot;
 expect(panel.getAttribute('aria-modal')).toBeNull();expect(root.querySelector('h3').textContent).toBe('<目标>');expect(retry).not.toHaveBeenCalled();
 [...root.querySelectorAll('button')].find(button=>button.textContent==='传送').click();expect(retry).toHaveBeenCalledOnce();
 [...root.querySelectorAll('button')].find(button=>button.textContent==='查看地图').click();expect(viewMap).toHaveBeenCalledOnce();
 root.querySelector('.close').click();expect(dismiss).toHaveBeenCalledOnce();expect(document.querySelector('.navi-action-panel')).toBeNull();
});
it('stops keyboard and pointer events reaching game controls', () => {
 const bubble=vi.fn();window.addEventListener('keydown',bubble);window.addEventListener('mousedown',bubble);
 try {
  showNaviActionPanel({title:'目标',message:'等待',retry:()=>{}});
  const button=document.querySelector('.navi-action-panel').shadowRoot.querySelector('nav button');
  button.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));
  button.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,composed:true}));expect(bubble).not.toHaveBeenCalled();
 } finally {window.removeEventListener('keydown',bubble);window.removeEventListener('mousedown',bubble);}
});
