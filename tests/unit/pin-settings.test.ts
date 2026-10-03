import { expect, it } from 'vitest';
import { changedPins, uniquePinnedTarget } from '../../src/core/pin-settings';
import type { Fingerprint } from '../../src/core/fingerprint';
const a: Fingerprint={id:'a',buttonText:'열기',domPath:'body/button[1]',framePath:[]};
const b: Fingerprint={id:'b',buttonText:'닫기',domPath:'body/button[2]',framePath:[]};
it('adds, explicitly replaces and removes one numbered setting without changing other pins',()=>{
 const initial=[{number:2,fingerprint:a}];
 const added=changedPins(initial,{number:4,expected:initial,fingerprint:b});
 expect(added).toEqual([...initial,{number:4,fingerprint:b}]);
 expect(changedPins(initial,{number:2,expected:initial,fingerprint:b})).toEqual([{number:2,fingerprint:b}]);
 expect(changedPins(initial,{number:2,expected:initial,fingerprint:null})).toEqual([]);
 expect(initial).toEqual([{number:2,fingerprint:a}]);
});
it('refuses observed concurrent change, no-op, invalid number, duplicate numbers and moving another pin silently',()=>{
 const initial=[{number:2,fingerprint:a}];
 for(const mutation of [{number:2,expected:[],fingerprint:b},{number:2,expected:initial,fingerprint:a},{number:0,expected:initial,fingerprint:b},{number:3,expected:initial,fingerprint:a},{number:4,expected:initial,fingerprint:null}])expect(changedPins(initial,mutation)).toBeNull();
 const duplicate=[...initial,...initial];expect(changedPins(duplicate,{number:2,expected:duplicate,fingerprint:null})).toBeNull();
});
it('a fixed target must have a unique match, not the first candidate in DOM order',()=>{
 expect(uniquePinnedTarget([{id:'a',fingerprint:a}],a)?.id).toBe('a');
 expect(uniquePinnedTarget([{id:'a',fingerprint:a},{id:'clone',fingerprint:{...a,domPath:'body/button[3]'}}],a)).toBeNull();
 expect(uniquePinnedTarget([{id:'other-frame',fingerprint:{...a,framePath:['child']}}],a)).toBeNull();
});
it('does not reattach a missing saved id/name to a unique weak text match',()=>{
 const saved={...a,aria:'열기'};
 expect(uniquePinnedTarget([{id:'replacement',fingerprint:{...saved,id:'different',domPath:'new/path'}}],saved)).toBeNull();
 expect(uniquePinnedTarget([{id:'replacement',fingerprint:{...saved,name:'other'}}],{...saved,name:'original'})).toBeNull();
 expect(uniquePinnedTarget([{id:'replacement',fingerprint:{buttonText:'열기',aria:'열기',domPath:'new/path',framePath:[]}}],{buttonText:'열기',aria:'열기',domPath:'old/path',framePath:[]})).toBeNull();
});
