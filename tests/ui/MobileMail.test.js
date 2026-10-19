import {beforeEach,it,expect,vi} from 'vitest';
const s=vi.hoisted(()=>({session:{Playing:true,zeny:100000,Entity:{action:0,ACTION:{DIE:99},display:{name:'发件人'}}},send:vi.fn(),items:[{index:2,ITID:501,count:8}]}));
vi.mock('Engine/SessionStorage.js',()=>({default:s.session}));
vi.mock('Network/NetworkManager.js',()=>({default:{sendPacket:s.send}}));
vi.mock('Network/PacketStructure.js',()=>({default:{CZ:new Proxy({}, {get:(t,k)=>t[k]||=(class{constructor(){this.packet=k;}})})}}));
vi.mock('UI/Components/Inventory/Inventory.js',()=>({default:{getUI:()=>({list:s.items})}}));
vi.mock('../../src/UI/Game/GameInventory.js',()=>({createGameInventory:()=>({snapshot:()=>s.items.map(i=>({index:i.index,ID:i.ITID,count:i.count,name:'红色药水'})),describe:i=>({...i,ID:i.ITID,name:'红色药水',description:'恢复 HP'})})}));
import {openGameMail,receiveGameMail,currentGameMail,gameMailUnread,setGameMailUnread} from '../../src/UI/Game/GameMail.js';
import {clearInteraction} from '../../src/UI/Game/ServerInteraction.js';
import {createMailPanel} from '../../src/UI/Mobile/game/MailPanel.js';
const mail={MailID:4294967300,openType:0,title:'测试',SenderName:'其他玩家',Isread:0,type:0};
function open(){const m=openGameMail();m.setOperationGuard(()=>true);m.receive('list',{MailList:[mail]});return m;}
function compose(){const m=open();m.compose();m.receive('compose',{result:1,receiveName:''});return m;}
beforeEach(()=>{clearInteraction();vi.clearAllMocks();s.session.Playing=true;s.session.zeny=100000;s.items=[{index:2,ITID:501,count:8}];});
it('correlates read and claim replies by full mail identity and only applies server results',()=>{const m=open();m.read('0:4294967300');m.receive('read',{...mail,MailID:4,zeny:10,ItemList:[],Textcontent:'正文'});expect(m.snapshot().pending).toBe(true);m.receive('read',{...mail,zeny:10,ItemList:[{ITID:501,count:1}],Textcontent:'正文'});m.delete();expect(s.send.mock.calls.some(([p])=>p.packet==='REQ_DELETE_RODEX')).toBe(false);m.claim('zeny');m.claim('zeny');expect(s.send.mock.calls.filter(([p])=>p.packet==='REQ_ZENY_FROM_RODEX')).toHaveLength(1);m.receive('zeny',{...mail,result:2});expect(m.snapshot().detail.zeny).toBe(10);m.claim('zeny');m.receive('zeny',{...mail,result:0});expect(m.snapshot().detail.zeny).toBe(0);m.claim('items');m.receive('items',{...mail,result:0});m.delete();m.delete();expect(s.send.mock.calls.filter(([p])=>p.packet==='REQ_DELETE_RODEX')).toHaveLength(1);expect(m.snapshot().list).toHaveLength(1);m.receive('delete',mail);expect(m.snapshot().list).toHaveLength(0);});
it('waits for server permission and attachment acknowledgments without reducing inventory',()=>{const m=open();m.compose();m.receive('compose',{result:0});expect(m.snapshot().writing).toBe(false);m.compose();m.receive('compose',{result:1,receiveName:''});m.add(2,501,9);expect(m.snapshot().pending).toBe(false);m.add(2,501,2);m.add(2,501,2);expect(s.send.mock.calls.filter(([p])=>p.packet==='REQ_ADD_ITEM_RODEX')).toHaveLength(1);m.receive('add',{result:0,index:2,ITID:501,count:2,weight:10});expect(m.snapshot().attachments[0].count).toBe(2);expect(s.items[0].count).toBe(8);m.remove(2,2);m.receive('remove',{result:1,index:2,count:2,weight:0});expect(m.snapshot().attachments).toHaveLength(0);});
it('requires validated recipient, exact review and UTF-8 byte lengths before sending once',()=>{const m=compose();m.change('receiver','收件人');m.change('title','中文标题');m.change('body','测试正文');expect(m.review().error).toContain('校验');m.validate();m.receive('validate',{CharID:42,name:'收件人',level:10});m.add(2,501,2);m.receive('add',{result:0,index:2,ITID:501,count:2,weight:10});const review=m.review();expect(review.fee).toBe(2500);m.change('zeny',100);m.send(review);expect(s.send.mock.calls.some(([p])=>p.packet==='REQ_SEND_RODEX2')).toBe(false);const next=m.review();m.send(next);m.send(next);const packets=s.send.mock.calls.filter(([p])=>p.packet==='REQ_SEND_RODEX2');expect(packets).toHaveLength(1);expect(packets[0][0]).toMatchObject({Titlelength:13,Bodylength:13,CharID:42,zeny:100});m.receive('send',{result:0});expect(m.snapshot().writing).toBe(false);expect(s.items[0].count).toBe(8);});
it('rejects stale attachments, insufficient funds and oversized multibyte content',()=>{const m=compose();m.change('receiver','valid');m.validate();m.receive('validate',{CharID:1,name:'valid'});m.change('title','汉'.repeat(14));expect(m.review().error).toContain('字节');m.change('title','标题');m.add(2,501,2);m.receive('add',{result:0,index:2,ITID:501,count:2});s.session.zeny=1;expect(m.review().error).toContain('余额');s.session.zeny=100000;s.items[0].ITID=502;expect(m.review().error).toContain('附件');});
it('invalidates close and disconnected operations and never reopens on delayed replies',()=>{const m=compose();m.close();m.close();expect(currentGameMail()).toBeNull();receiveGameMail('compose',{result:1});m.add(2,501,1);expect(s.send.mock.calls.filter(([p])=>p.packet==='CLOSE_RODEXBOX')).toHaveLength(1);expect(s.send.mock.calls.filter(([p])=>p.packet==='REQ_CANCEL_WRITE_RODEX')).toHaveLength(1);const other=open();s.session.Playing=false;other.compose();expect(other.snapshot().writing).toBe(false);});
it('preserves composing input through periodic updates and requires an explicit send confirmation',()=>{const m=compose(),body=document.body.appendChild(document.createElement('div')),panel=createMailPanel(body,m);const input=[...body.querySelectorAll('label')].find(x=>x.textContent.includes('标题')).querySelector('input');input.value='草稿';input.dispatchEvent(new Event('input'));panel.update();expect(body.contains(input)).toBe(true);expect(input.value).toBe('草稿');expect(m.snapshot().draft.title).toBe('草稿');expect(s.send.mock.calls.some(([p])=>p.packet==='REQ_SEND_RODEX2')).toBe(false);});

it("rejects opening requests after death, disconnection or an existing modal restriction",()=>{expect(openGameMail(()=>false)).toBeNull();s.session.Playing=false;expect(openGameMail()).toBeNull();s.session.Playing=true;s.session.Entity.action=99;expect(openGameMail()).toBeNull();s.session.Entity.action=0;expect(s.send).not.toHaveBeenCalled();});

it('keeps category selection, search and pagination separate from mail rows',()=>{
 const m=open(),body=document.body.appendChild(document.createElement('div')),panel=createMailPanel(body,m);
 expect(body.querySelector('select[aria-label="邮箱分类"]').value).toBe('0');
 expect(body.querySelector('[aria-label="上一页"]').disabled).toBe(true);
 expect(body.querySelector('[aria-label="下一页"]').disabled).toBe(true);
 const search=body.querySelector('input[type="search"]');search.value='不存在';search.dispatchEvent(new Event('input'));
 search.dispatchEvent(new Event('change'));
 expect(body.querySelector('.mail-rows').textContent).toContain('没有匹配的邮件');
 panel.update();expect(body.querySelector('[aria-label="下一页"]').disabled).toBe(true);
 const category=body.querySelector('select');category.value='1';category.dispatchEvent(new Event('change'));
 expect(body.querySelector('select').value).toBe('1');
});
it('hides reviewed send confirmation as soon as the draft changes',()=>{
 const m=compose();m.change('receiver','收件人');m.validate();m.receive('validate',{CharID:42,name:'收件人'});m.change('title','标题');
 const body=document.body.appendChild(document.createElement('div'));createMailPanel(body,m);
 const button=text=>[...body.querySelectorAll('button')].find(node=>node.textContent===text);
 button('发送邮件').click();expect(body.querySelector('dialog').open).toBe(true);
 const input=[...body.querySelectorAll('label')].find(node=>node.textContent.includes('标题')).querySelector('input');
 input.value='新标题';input.dispatchEvent(new Event('input'));
 expect(body.querySelector('dialog')).toBeNull();
});

it('distinguishes invalid input, pending requests, failed claims and confirmed success', () => {
 const m = compose();
 m.validate();
 expect(m.snapshot().messageKind).toBe('error');
 m.change('receiver', '收件人'); m.validate();
 expect(m.snapshot().messageKind).toBe('pending');
 m.receive('validate', {CharID: 42, name: '收件人', level: 10});
 expect(m.snapshot().messageKind).toBe('success');
 m.cancelCompose(); m.read('0:4294967300');
 m.receive('read', {...mail, zeny: 10, ItemList: [], Textcontent: '正文'});
 m.claim('zeny');
 expect(m.snapshot().messageKind).toBe('pending');
 m.receive('zeny', {...mail, result: 2});
 expect(m.snapshot().messageKind).toBe('error');
 m.claim('zeny'); m.receive('zeny', {...mail, result: 0});
 expect(m.snapshot().messageKind).toBe('success');
});

it('clears the mail badge only after all loaded unread messages are read or removed',()=>{
 setGameMailUnread(true);
 const m=openGameMail();m.setOperationGuard(()=>true);
 const first={...mail},second={...mail,MailID:12};
 m.receive('list',{MailList:[first,second]});expect(gameMailUnread()).toBe(true);
 m.read('0:4294967300');m.receive('read',{...first,ItemList:[],Textcontent:'正文'});
 expect(gameMailUnread()).toBe(true);expect(first.Isread).toBe(0);
 m.read('0:12');m.receive('read',{...second,ItemList:[],Textcontent:'正文'});
 expect(gameMailUnread()).toBe(false);
 setGameMailUnread(true);expect(gameMailUnread()).toBe(true);
 receiveGameMail('list',{MailList:[{...first,Isread:1},{...second,Isread:1}]});
 expect(gameMailUnread()).toBe(false);
});

it('keeps notification on failed list loads and updates it from server refreshes outside the mail window',()=>{
 setGameMailUnread(true);const m=openGameMail();m.receive('listFailed',{});
 expect(gameMailUnread()).toBe(true);m.close();
 receiveGameMail('list',{MailList:[]});expect(gameMailUnread()).toBe(false);
 receiveGameMail('list',{MailList:[{...mail,Isread:0}]});expect(gameMailUnread()).toBe(true);
});

it('shows selection and loading immediately before a mail response arrives', () => {
 const service = open();
 const body = document.createElement('div');
 createMailPanel(body, service);
 body.querySelector('.mail-row').click();
 expect(body.querySelector('.mail-row').getAttribute('aria-pressed')).toBe('true');
 expect(body.querySelector('.mail-detail').textContent).toContain('正在读取邮件');
 expect(service.snapshot().pending).toBe(true);
 expect(service.snapshot().inventory).toEqual([]);
});
