import { expect, it, vi } from 'vitest';
import { createQuantityStepper } from '../../src/UI/Components/QuantityStepper.js';
it('refreshes live limits before stepping and preserves drafts when bounds shrink', () => {
 let stepper;
 stepper = createQuantityStepper({label:'数量',value:12,min:1,max:100,beforeStep:()=>stepper.setBounds({min:1,max:5})});
 const listener=vi.fn();stepper.input.addEventListener('input',listener);
 stepper.setBounds({min:1,max:20});expect(stepper.input.value).toBe('12');
 stepper.element.querySelectorAll('button')[2].click();
 expect(stepper.input.value).toBe('5');expect(listener).toHaveBeenCalledOnce();
 stepper.setBounds({min:1,max:3});expect(stepper.input.value).toBe('5');expect(stepper.input.checkValidity()).toBe(false);
});
it('does not change the input when its owner cancels the operation before a step',()=>{
 const stepper=createQuantityStepper({label:'数量',value:1,min:1,max:100,beforeStep:()=>false});
 stepper.element.querySelectorAll('button')[3].click();expect(stepper.input.value).toBe('1');
});
