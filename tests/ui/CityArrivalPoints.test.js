import { describe, expect, it, vi } from 'vitest';
vi.mock('Core/Client.js', () => ({ default: {} }));
vi.mock('DB/DBManager.js', () => ({ default: {} }));
vi.mock('DB/Map/MiniMapTable.js', () => ({ default: {} }));
vi.mock('Renderer/Map/Altitude.js', () => ({ default: { TYPE: { WALKABLE: 1 } } }));
import { findDefaultMapCoordinate, findNearestWalkableCoordinate } from '../../src/UI/Components/GameTools/WorldAssetService.js';
import { cityArrivalPoints } from '../../src/UI/Components/GameTools/CityArrivalPoints.js';
function grid() {
 const cells = new Uint8Array(400 * 400 * 5);
 for(let i=4;i<cells.length;i+=5) cells[i]=1;
 return {width:400,height:400,cells};
}
describe('default city arrivals', () => {
 it.each(Object.keys(cityArrivalPoints))('uses the reviewed service NPC area for %s', map => {
  const {x,y}=cityArrivalPoints[map];
  expect(findDefaultMapCoordinate(grid(),map)).toEqual({x,y});
 });
 it('asks the server to choose a safe default for other maps', () => {
  expect(findDefaultMapCoordinate(grid(),'prt_fild08')).toEqual({x:0,y:0,automatic:true});
 });
 it('adjusts a blocked preset and preserves explicit walkable selections', () => {
  const gat=grid(), {x,y}=cityArrivalPoints.geffen;
  gat.cells[(y*400+x)*5+4]=0;
  expect(findDefaultMapCoordinate(gat,'geffen')).not.toEqual({x,y});
  expect(findNearestWalkableCoordinate(gat,{x:100,y:100})).toEqual({x:100,y:100});
 });
});
