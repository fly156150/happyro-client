import {expect,it,vi} from 'vitest';
vi.mock('Engine/SessionStorage.js',()=>({default:{AID:100,Entity:{GID:100,display:{name:'自己'}}}}));
import {chatSpeakerMetadata} from '../../src/UI/Game/ChatSpeaker.js';
it('identifies self and other speakers from packet IDs or exact names',()=>{
 for(const speaker of [{id:100},{id:0},{name:'自己'},{name:''},{}]) expect(chatSpeakerMetadata(speaker).replyable).toBe(false);
 for(const speaker of [{id:200},{name:'队友'},{name:'自己二号'}]) expect(chatSpeakerMetadata(speaker).replyable).toBe(true);
});
