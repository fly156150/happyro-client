import { afterEach, expect, it, vi } from 'vitest';
vi.mock('UI/CursorManager.js', () => ({default:{ACTION:{DEFAULT:0,CLICK:1,NOWALK:2},type:0,getActualType(){return this.type;},setType(type){this.type=type;}}}));
vi.mock('DB/DBManager.js', () => ({default:{}}));
vi.mock('Core/Client.js', () => ({default:{}}));
vi.mock('Renderer/Renderer.js', () => ({default:{}}));
vi.mock('Renderer/EntityManager.js', () => ({default:{setOverEntity:vi.fn()}}));
vi.mock('UI/Scrollbar.js', () => ({default:{}}));
import GUIComponent from '../../src/UI/GUIComponent.js';
import Cursor from '../../src/UI/CursorManager.js';
import Mouse from '../../src/Controls/MouseEventHandler.js';
afterEach(()=>document.body.replaceChildren());
it('does not restore the blocked map cursor when moving from a control to panel text',async()=>{
 const component=new GUIComponent('CursorTest');
 component.render=()=>'<button>设置</button><p>设置说明</p>';
 component.prepare(); await vi.dynamicImportSettled(); document.body.append(component._host);
 Mouse.intersect=true;Cursor.type=Cursor.ACTION.NOWALK;
 const button=component._container.querySelector('button'),text=component._container.querySelector('p');
 // Browser mouseover bubbles before mouseenter reaches the component host.
 button.dispatchEvent(new MouseEvent('mouseover',{bubbles:true,composed:true}));
 component._host.dispatchEvent(new MouseEvent('mouseenter'));
 button.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:text}));
 expect(Mouse.intersect).toBe(false);
 expect(Cursor.type).toBe(Cursor.ACTION.DEFAULT);
 component._host.dispatchEvent(new MouseEvent('mouseleave'));
 expect(Mouse.intersect).toBe(true);
});
