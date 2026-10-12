import {expect,it,vi} from 'vitest';
vi.mock('Core/Client.js',()=>({default:{}}));
vi.mock('DB/DBManager.js',()=>({default:{}}));
vi.mock('DB/Map/MiniMapTable.js',()=>({default:{}}));
vi.mock('Renderer/Map/Altitude.js',()=>({default:{TYPE:{WALKABLE:1}}}));
import {findNearestWalkableCoordinate} from '../../src/UI/Components/GameTools/WorldAssetService.js';
it('preserves explicit walkable selections and adjusts blocked selections',()=>{
 const cells=new Uint8Array(40*40*5);for(let i=4;i<cells.length;i+=5)cells[i]=1;
 const grid={width:40,height:40,cells};expect(findNearestWalkableCoordinate(grid,{x:20,y:20})).toEqual({x:20,y:20});
 cells[(20*40+20)*5+4]=0;expect(findNearestWalkableCoordinate(grid,{x:20,y:20})).not.toEqual({x:20,y:20});
});
