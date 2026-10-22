import { expect, it, vi } from 'vitest';
vi.mock('DB/DBManager.js', () => ({ default: { getMessage: id => String(id) } }));
vi.mock('Core/Client.js', () => ({ default: {} }));
vi.mock('Core/Preferences.js', () => ({ default: { get: () => ({ x: 0, y: 0 }) } }));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1200, height: 800 } }));
vi.mock('UI/Components/ChatBox/ChatBox.js', () => ({ default: {} }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: value => value } }));
vi.mock('UI/GUIComponent.js', () => ({ default: class { static processDataAttrs() {} draggable() {} focus() {} } }));
import Rodex from '../../src/UI/Components/Rodex/Rodex.js';
import PACKET from '../../src/Network/PacketStructure.js';
it.each([25n, 4294967300n])('clicking a desktop mail serializes its real 64-bit ID: %s', id => {
 document.body.innerHTML = Rodex.render();
 Rodex._host = document.querySelector('#Rodex'); Rodex._shadow = null;
 Rodex.onAppend();
 Rodex.list = [{ MailID: id, openType: 0, title: 'Acceptance mail', SenderName: 'Admin', type: 4, IsRead: false, DeleteTime: 86400 }];
 const sent = [];
 Rodex.requestReadRodex = (openType, MailID) => {
  const packet = new PACKET.CZ.REQ_READ_RODEX(); Object.assign(packet, { openType, MailID }); sent.push(packet.build().buffer);
 };
 Rodex.createRodexList(0);
 document.querySelector(`#mail_${id}`).click();
 expect(sent).toHaveLength(1);
 expect(new DataView(sent[0]).getBigUint64(3, true)).toBe(id);
 expect(new DataView(sent[0]).getUint8(2)).toBe(0);
});
