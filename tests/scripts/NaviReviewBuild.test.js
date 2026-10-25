import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyNaviReview } from '../../scripts/verify-navi-review.mjs';
const folders = [];
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
function fixture() {
 const root = fs.mkdtempSync(path.join(os.tmpdir(), 'happyro-navi-build-'));folders.push(root);
 fs.mkdirSync(path.join(root,'src/DB/Navigation'),{recursive:true});fs.mkdirSync(path.join(root,'src/DB/Map'),{recursive:true});
 const source = 'export default new Set(["izlude"]);';
 fs.writeFileSync(path.join(root,'src/DB/Map/SupportedMapTable.js'),source);
 // Keys deliberately in canonical serialization order, same artifact format as review.py.
 const payload = {accessPolicy:'adventure-tools-server-rules',entries:{'izlude,122,207':{kind:'coordinate',mapName:'izlude',x:122,y:207}},schema:1,sources:{'repos/happyro-client/src/DB/Map/SupportedMapTable.js':hash(source)}};
 const version=hash(JSON.stringify(payload,null,2)+'\n');
 fs.writeFileSync(path.join(root,'src/DB/Navigation/NaviTargets.json'),JSON.stringify({...payload,version}));
 return {root,version};
}
afterEach(()=>{for(const dir of folders.splice(0))fs.rmSync(dir,{recursive:true,force:true});});
it('accepts the reviewed standalone client inputs without needing server checkout',()=>{
 const {root,version}=fixture();expect(verifyNaviReview(root)).toBe(version);
});
it('blocks a build after the supported-map input changes',()=>{
 const {root}=fixture();fs.appendFileSync(path.join(root,'src/DB/Map/SupportedMapTable.js'),'\n// changed');
 expect(()=>verifyNaviReview(root)).toThrow('stale');
});
it('blocks a build if a target was edited without a reviewed artifact',()=>{
 const {root}=fixture();const file=path.join(root,'src/DB/Navigation/NaviTargets.json');const data=JSON.parse(fs.readFileSync(file));
 data.entries['izlude,122,207'].x=123;fs.writeFileSync(file,JSON.stringify(data));
 expect(()=>verifyNaviReview(root)).toThrow('invalid or has changed');
});
