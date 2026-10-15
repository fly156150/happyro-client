import {beforeEach,expect,it,vi} from 'vitest';
const s=vi.hoisted(()=>({mobile:true,hooks:new Map(),add:vi.fn(),whisper:vi.fn(),store:{nick:'对方',msg:'已发送'},friend:false}));
vi.mock('UI/Platform.js',()=>({default:{get isMobile(){return s.mobile;}}}));
vi.mock('DB/DBManager.js',()=>({default:{getMessage:id=>String(id)}}));
vi.mock('Engine/MapEngine/Friends.js',()=>({default:{isFriend:()=>s.friend}}));
vi.mock('Network/NetworkManager.js',()=>({default:{hookPacket:(type,fn)=>s.hooks.set(type,fn),sendPacket:vi.fn()}}));
vi.mock('Network/PacketStructure.js',()=>({default:{ZC:{WHISPER:'in',WHISPER2:'in2',ACK_WHISPER:'ack',ACK_WHISPER2:'ack2'},CZ:{WHISPER:class {}}}}));
vi.mock('Network/PacketVerManager.js',()=>({default:{value:20211103}}));
vi.mock('UI/Components/ChatBox/ChatBox.js',()=>({default:{addText:s.add,saveNickName:vi.fn(),PrivateMessageStorage:s.store,TYPE:{PRIVATE:2,SELF:1,ERROR:4},FILTER:{WHISPER:3}}}));
vi.mock('UI/Components/WhisperBox/WhisperBox.js',()=>({default:{instances:{},preferences:{open1to1Friend:true,open1to1Stranger:true},addText:s.whisper}}));
vi.mock('Engine/SessionStorage.js',()=>({default:{Entity:{display:{name:'自己'}}}}));
import initialize from '../../src/Engine/MapEngine/PrivateMessage.js';
beforeEach(()=>{vi.clearAllMocks();s.mobile=true;s.friend=false;s.store.nick='对方';s.store.msg='已发送';initialize();});
it('routes incoming mobile whispers to the shared chat feed even when desktop popup preferences are enabled',()=>{
 s.hooks.get('in')({sender:'对方',msg:'收到私聊'});expect(s.whisper).not.toHaveBeenCalled();expect(s.add).toHaveBeenCalledWith([`[ 来自 `, {kind:'nickname',text:'对方'}, ' ] : ', '收到私聊'],2,3);
});
it('shows mobile sent acknowledgements and errors in the private channel without a desktop window',()=>{
 s.hooks.get('ack')({result:0});expect(s.add).toHaveBeenCalledWith(['[ To ', {kind:'nickname',text:'对方'}, ' ] : ', '已发送'],3,3);expect(s.store.nick).toBe('');s.store.nick='对方';s.hooks.get('ack')({result:1});expect(s.add).toHaveBeenLastCalledWith(expect.stringContaining('148'),4,3);expect(s.whisper).not.toHaveBeenCalled();
});
it('preserves desktop one-to-one popup preferences',()=>{s.mobile=false;s.hooks.get('in')({sender:'对方',msg:'桌面私聊'});expect(s.whisper).toHaveBeenCalledOnce();expect(s.add).not.toHaveBeenCalled();});
