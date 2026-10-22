import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('DB/DBManager.js', () => ({ default: { getItemInfo: () => ({}), getMessage: id => `message-${id}` } }));
vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1200, height: 800 } }));
vi.mock('Renderer/EntityManager.js', () => ({ default: {} }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: value => value } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class { draggable() {} append() {} } }));
vi.mock('UI/Components/ItemInfo/ItemInfo.js', () => ({ default: { remove: vi.fn() } }));
vi.mock('UI/Components/VendingShop/VendingShop.js', () => ({ default: {} }));
vi.mock('UI/Elements/Elements.js', () => ({}));
import report from '../../src/UI/Components/VendingReport/VendingReport.js';
import message from '../../src/UI/Components/Vending/VendingModelMessage/VendingModelMessage.js';
beforeEach(() => {
 document.body.innerHTML = '';
 for (const component of [report, message]) {
  component._host = document.body.appendChild(document.createElement('div'));
  component._shadow = component._host.attachShadow({ mode: 'open' });
  component._shadow.innerHTML = component.render();
 }
 report.reset();
});
it('shows an empty receipt, hides it for sales and restores it for the next stall', () => {
 const empty = report._shadow.querySelector('.empty');
 expect(empty.hidden).toBe(false);
 expect(empty.textContent).toBe('本次摆摊暂无成交记录');
 report.addItem({ ITID: 501, shopindex: 1, reportId: 1, count: 2, buyer: '买家', zeny: 200, date: '10/22' });
 expect(empty.hidden).toBe(true);
 expect(report._shadow.querySelectorAll('.item')).toHaveLength(1);
 report.reset();
 expect(empty.hidden).toBe(false);
 expect(report._shadow.querySelectorAll('.item')).toHaveLength(0);
});
it('centers the report using its actual rendered dimensions', () => {
 report._host.getBoundingClientRect = () => ({ width: 400, height: 184 });
 report.onAppend();
 expect(report._host.style.left).toBe('400px');
 expect(report._host.style.top).toBe('308px');
});
it('shows contextual stall validation while retaining other numeric messages', () => {
 message.setInit('请输入摊位名称');
 expect(message._shadow.querySelector('.message').textContent).toBe('请输入摊位名称');
 expect(message._shadow.querySelector('.titlebar').textContent).toContain('摆摊提示');
 message.setInit(2494);
 expect(message._shadow.querySelector('.message').textContent).toBe('message-2494');
});
