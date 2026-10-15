import {it,expect,vi} from 'vitest';
import PACKET from '../../src/Network/PacketStructure.js';
import {validateSocialText} from '../../src/Utils/SocialText.js';
const chat=vi.hoisted(()=>vi.fn());
vi.mock('UI/Components/ChatBox/ChatBox.js',()=>({default:{addText:chat,TYPE:{ERROR:1},FILTER:{PUBLIC_LOG:0}}}));
import {allowSocialText} from '../../src/Engine/MapEngine/SocialText.js';
it('preserves accepted multibyte fields and leaves a terminating zero in their packets',()=>{
 const name='ab'+'中'.repeat(7),subject='ab'+'中'.repeat(19),notice='ab'+'中'.repeat(39);
 expect(validateSocialText({name,subject,notice,reason:'中'.repeat(13)})).toBe('');
 const party=new PACKET.CZ.MAKE_GROUP2();party.groupName=name;
 const bytes=new Uint8Array(party.build().buffer,2,24);
 expect(bytes[23]).toBe(0);expect(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,23))).toBe(name);
 const guild=new PACKET.CZ.GUILD_NOTICE();Object.assign(guild,{subject,notice});const b=new Uint8Array(guild.build().buffer);
 expect(b[65]).toBe(0);expect(b[185]).toBe(0);
 expect(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(6,65))).toBe(subject);
 expect(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(66,185))).toBe(notice);
});
it('rejects overlong ASCII, mixed Chinese, emoji and embedded NUL without silently truncating',()=>{
 for(const name of ['x'.repeat(24),'a'+'中'.repeat(8),'😀'.repeat(6),'a\0b']) expect(validateSocialText({name})).not.toBe('');
 expect(validateSocialText({subject:'中'.repeat(20)})).not.toBe('');
 expect(validateSocialText({subject:'',notice:'第一行\n第二行',reason:''})).toBe('');
});
it('shows shared desktop request errors before packet submission',()=>{
 expect(allowSocialText({name:'中'.repeat(8)})).toBe(false);expect(chat).toHaveBeenCalledWith(expect.stringContaining('23 字节'),1,0);
 expect(allowSocialText({name:'队伍'})).toBe(true);
});
