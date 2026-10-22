import {beforeEach,it,expect,vi} from 'vitest';
const s=vi.hoisted(()=>({mobile:true,hooks:new Map(),send:vi.fn(),open:vi.fn(),model:{acknowledge:vi.fn(),receive:vi.fn(),conclude:vi.fn(),finish:vi.fn()},trade:{title:'玩家',append:vi.fn(),remove:vi.fn(),addItemFromInventory:vi.fn(),addItem:vi.fn(),conclude:vi.fn()},prompt:vi.fn()}));
vi.mock('UI/Platform.js',()=>({default:{get isMobile(){return s.mobile;}}}));
vi.mock('UI/Game/GameTrade.js',()=>({openGameTrade:s.open,currentGameTrade:()=>s.model}));
vi.mock('UI/Components/Trade/Trade.js',()=>({default:s.trade}));
vi.mock('UI/UIManager.js',()=>({default:{showPromptBox:s.prompt}}));
vi.mock('UI/Components/ChatBox/ChatBox.js',()=>({default:{addText:vi.fn(),TYPE:{ERROR:0,BLUE:1},FILTER:{PUBLIC_LOG:0}}}));
vi.mock('DB/DBManager.js',()=>({default:{getMessage:id=>String(id)}}));
vi.mock('Network/NetworkManager.js',()=>({default:{sendPacket:s.send,hookPacket:(kind,callback)=>s.hooks.set(kind,callback)}}));
vi.mock('Network/PacketStructure.js',()=>{const group=()=>new Proxy({}, {get:(t,k)=>t[k]||=(class{constructor(){this.packet=k;}})});return{default:{CZ:group(),ZC:group()}};});
import initialize from '../../src/Engine/MapEngine/Trade.js';
import PACKET from 'Network/PacketStructure.js';
const receive=(name,pkt)=>s.hooks.get(PACKET.ZC[name])(pkt);
beforeEach(()=>{vi.clearAllMocks();s.mobile=true;s.trade.title='玩家';initialize();});
it('opens the mobile model and routes all trade replies without mounting the desktop window',()=>{
 receive('ACK_EXCHANGE_ITEM2',{result:3});expect(s.open).toHaveBeenCalledWith('玩家',expect.objectContaining({add:expect.any(Function),lock:expect.any(Function),execute:expect.any(Function),cancel:expect.any(Function)}));receive('ACK_ADD_EXCHANGE_ITEM',{Index:4,result:0});receive('ADD_EXCHANGE_ITEM5',{ITID:501,count:2});receive('CONCLUDE_EXCHANGE_ITEM',{who:1});receive('EXEC_EXCHANGE_ITEM',{result:0});expect(s.model.acknowledge).toHaveBeenCalledWith(4,0);expect(s.model.receive).toHaveBeenCalledWith({ITID:501,count:2});expect(s.model.conclude).toHaveBeenCalledWith(true);expect(s.model.finish).toHaveBeenCalledWith('75',true);expect(s.trade.append).not.toHaveBeenCalled();expect(s.trade.addItemFromInventory).not.toHaveBeenCalled();
});
it('keeps the existing desktop reply route',()=>{s.mobile=false;receive('ACK_EXCHANGE_ITEM',{result:3});receive('ACK_ADD_EXCHANGE_ITEM',{Index:4,result:0});receive('CONCLUDE_EXCHANGE_ITEM',{who:0});receive('CANCEL_EXCHANGE_ITEM',{});expect(s.trade.append).toHaveBeenCalledOnce();expect(s.trade.addItemFromInventory).toHaveBeenCalledWith(4,true);expect(s.trade.conclude).toHaveBeenCalledWith('send');expect(s.trade.remove).toHaveBeenCalledOnce();expect(s.open).not.toHaveBeenCalled();});
it('preserves explicit invitation acceptance and the original action packet fields',()=>{
 receive('REQ_EXCHANGE_ITEM2',{name:'朋友',GID:42,level:10});expect(s.send).not.toHaveBeenCalled();s.prompt.mock.calls[0][3]();expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({packet:'ACK_EXCHANGE_ITEM',result:3}));s.trade.reqAddItem(4,2);expect(s.send).toHaveBeenLastCalledWith(expect.objectContaining({packet:'ADD_EXCHANGE_ITEM',index:4,count:2}));s.trade.onConclude();s.trade.onTradeSubmit();s.trade.onCancel();expect(s.send.mock.calls.slice(-3).map(([p])=>p.packet)).toEqual(['CONCLUDE_EXCHANGE_ITEM','EXEC_EXCHANGE_ITEM','CANCEL_EXCHANGE_ITEM']);
});
