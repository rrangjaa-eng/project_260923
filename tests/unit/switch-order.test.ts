import {expect,it} from 'vitest';
import {snapshotTargets} from '../../src/core/switch-order';
it('keeps a DOM snapshot in frame order without using cursor or frequency',()=>{
  const item=(id:string)=>({itemId:id,label:id,kind:'a',danger:false,editable:false,sensitive:false,identity:id});
  const frames=[{frameId:2,documentGeneration:'B',path:[1],items:[item('second')]},{frameId:0,documentGeneration:'A',path:[],items:[item('first')]}];
  const snapshot=snapshotTargets(9,frames);
  expect(snapshot.map((t)=>t.target.itemId)).toEqual(['first','second']);
  frames[1]?.items.push(item('later'));
  expect(snapshot.map((t)=>t.target.itemId)).toEqual(['first','second']);
});
