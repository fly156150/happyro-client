import {beforeEach, expect, it, vi} from 'vitest';
const s=vi.hoisted(()=>({hooks:new Map(),send:vi.fn(),ui:{setFriends:vi.fn(),updateFriendState:vi.fn()}}));
vi.mock('Network/NetworkManager.js',()=>({default:{hookPacket:(type,callback)=>s.hooks.set(type,callback),sendPacket:s.send}}));
vi.mock('UI/Components/PartyFriends/PartyFriends.js',()=>({default:{getUI:()=>s.ui}}));
vi.mock('UI/UIManager.js',()=>({default:{}}));
vi.mock('UI/Components/ChatBox/ChatBox.js',()=>({default:{}}));
vi.mock('DB/DBManager.js',()=>({default:{}}));
import Friends from '../../src/Engine/MapEngine/Friends.js';
import PACKET from '../../src/Network/PacketStructure.js';
import BinaryReader from '../../src/Utils/BinaryReader.js';
beforeEach(()=>{vi.useRealTimers();vi.clearAllMocks();Friends.free();Friends.init();});
it('decodes account, character, level and map using the 28-byte server layout',()=>{
 const buffer=new ArrayBuffer(26),data=new DataView(buffer);data.setUint32(0,10,true);data.setUint32(4,20,true);data.setUint16(8,200,true);new Uint8Array(buffer,10).set(new TextEncoder().encode('prontera'));
 expect(new PACKET.ZC.HAPPYRO_FRIEND_DETAIL(new BinaryReader(buffer))).toEqual({AID:10,GID:20,baseLevel:200,mapName:'prontera'});
 expect(new DataView(new PACKET.CZ.HAPPYRO_FRIEND_DETAILS().build().buffer).getUint16(0,true)).toBe(0xd0a);
});
it('polls online friend details without scene entities, throttles requests and clears on logout',()=>{
 const friend={AID:10,GID:20,Name:'朋友',State:0};s.hooks.get(PACKET.ZC.FRIENDS_LIST)({friendList:[friend]});
 Friends.detailsFor(friend);Friends.detailsFor(friend);expect(s.send).toHaveBeenCalledTimes(1);
 s.hooks.get(PACKET.ZC.HAPPYRO_FRIEND_DETAIL)({AID:10,GID:20,baseLevel:99,mapName:'geffen'});
 expect(Friends.detailsFor(friend)).toEqual({baseLevel:99,mapName:'geffen'});
 s.hooks.get(PACKET.ZC.FRIENDS_STATE)({AID:10,GID:20,State:1});expect(Friends.detailsFor(friend)).toBeUndefined();
 Friends.free();expect(Friends.detailsFor({...friend,State:0})).toBeUndefined();
});
it('does not accept details for a different character or account',()=>{
 const friend={AID:10,GID:20,State:0};s.hooks.get(PACKET.ZC.FRIENDS_LIST)({friendList:[friend]});
 s.hooks.get(PACKET.ZC.HAPPYRO_FRIEND_DETAIL)({AID:11,GID:20,baseLevel:99,mapName:'geffen'});
 expect(Friends.detailsFor(friend)).toBeUndefined();
});
