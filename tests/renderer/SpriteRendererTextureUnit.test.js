import { expect, it, vi } from 'vitest';
vi.mock('Utils/WebGL.js', () => ({ default: { createShaderProgram: () => ({attribute:{},uniform:{}}) } }));
vi.mock('../../src/Renderer/Camera.js', () => ({ default: {zoom:200,getLatitude:()=>45} }));
import SpriteRenderer from '../../src/Renderer/SpriteRenderer.js';
import { mat4 } from '../../src/Utils/gl-matrix.js';

it('binds non-paletted sky textures to diffuse unit zero after the ground uses unit two', () => {
 let active=2;
 const textures=new Map([[0,'ground-atlas'],[2,'tile-colors']]);
 const sampled=[];
 const noop=()=>{};
 const gl={TEXTURE0:0,TEXTURE1:1,TEXTURE2:2,TEXTURE_2D:3553,
  createBuffer:()=>({}),bindBuffer:noop,bufferData:noop,useProgram:noop,
  uniformMatrix4fv:noop,uniform1i:noop,uniform1f:noop,uniform2fv:noop,uniform3fv:noop,uniform4fv:noop,
  enableVertexAttribArray:noop,vertexAttribPointer:noop,
  activeTexture:unit=>{active=unit;},bindTexture:(target,texture)=>textures.set(active,texture),
  drawArrays:()=>sampled.push(textures.get(0))};
 SpriteRenderer.init(gl);
 SpriteRenderer.bind3DContext(gl,mat4.create(),mat4.create(),{use:false,exist:false,color:[0,0,0]});
 SpriteRenderer.color.set([1,1,1,1]);
 SpriteRenderer.image.palette=null;
 SpriteRenderer.image.texture='cloud';
 SpriteRenderer.sprite={type:1};
 SpriteRenderer.render();
 expect(sampled).toEqual(['cloud']);
 expect(textures.get(2)).toBe('tile-colors');
 // A later ground pass changes unit zero too, even when the cloud texture is unchanged.
 gl.activeTexture(0);gl.bindTexture(gl.TEXTURE_2D,'ground-atlas');gl.activeTexture(2);
 SpriteRenderer.bind3DContext(gl,mat4.create(),mat4.create(),{use:false,exist:false,color:[0,0,0]});
 SpriteRenderer.render();
 expect(sampled).toEqual(['cloud','cloud']);
});
