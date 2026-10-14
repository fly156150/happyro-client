import {expect,it,vi} from 'vitest';
vi.mock('UI/Components/Confirmation.js',()=>({confirmAction:vi.fn()}));
import {confirmAction} from 'UI/Components/Confirmation.js';
import {requestGameToolsNumber} from '../../src/UI/Components/GameTools/GameToolsNumberPrompt.js';
it('steps in both directions, clamps bounds, and returns the entered number',async()=>{
 const result=requestGameToolsNumber(document.body,{title:'发放',label:'数量',value:1,min:1,max:30,steps:true});
 const [, , confirm,{content}]=confirmAction.mock.lastCall;
 const buttons=content.querySelectorAll('button'),input=content.querySelector('input');
 expect([...buttons].map(b=>b.textContent)).toEqual(['-10','-1','+1','+10']);
 expect(buttons[0].disabled).toBe(true);
 buttons[3].click();expect(input.value).toBe('11');buttons[1].click();expect(input.value).toBe('10');
 buttons[0].click();expect(input.value).toBe('1');
 input.value='29';input.dispatchEvent(new Event('input'));buttons[3].click();expect(input.value).toBe('30');expect(buttons[2].disabled).toBe(true);
 input.value='1.5';expect(input.checkValidity()).toBe(false);
 input.value='0';expect(input.checkValidity()).toBe(false);
 input.value='12';expect(input.checkValidity()).toBe(true);confirm();expect(await result).toBe(12);
});
it('returns null on cancellation',async()=>{
 const result=requestGameToolsNumber(document.body,{title:'发放',label:'数量',value:1,min:1,max:30,steps:true});
 confirmAction.mock.lastCall[3].cancelled();expect(await result).toBeNull();
});
