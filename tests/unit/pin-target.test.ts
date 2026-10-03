// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { capturePinTarget } from '../../src/page/input/pin-target';
import type { Collector, Item } from '../../src/page/collector/collector';
afterEach(()=>{document.body.innerHTML='';});
function fixture(html='<button type="button">열기</button>'){
 document.body.innerHTML=html;const el=document.body.firstElementChild;if(!el)throw new Error('fixture element missing');const item:Item={id:'target',name:'열기',kind:'button',danger:false,rect:{x:0,y:0,w:100,h:50},fingerprint:{id:'target',buttonText:'열기',domPath:'body/button',framePath:[]}};
 const collector:Collector={items:()=>[item],get:()=>document.body.firstElementChild??undefined,refresh:()=>undefined,onChange:()=>undefined};return {el,item,collector};
}
it('captures a native button without dispatching click and invalidates the same node after reinsertion',()=>{
 const f=fixture();let clicks=0;f.el.addEventListener('click',()=>clicks++);const capture=capturePinTarget(f.collector,'target');expect(capture).not.toBeNull();expect(capture?.valid()).toBe(true);expect(clicks).toBe(0);f.el.remove();document.body.append(f.el);expect(capture?.valid()).toBe(false);capture?.dispose();
});
it.each(['<button>제출</button>','<button type="reset">초기화</button>','<button type="button" contenteditable>내용</button>','<button type="button"><input value="개인정보"></button>','<a href="javascript:void(0)">링크</a>','<div role="button">버튼</div>'])('excludes unsupported or editable composites %s',html=>{const f=fixture(html);expect(capturePinTarget(f.collector,'target')).toBeNull();});
it('changed identity or disabled state invalidates the captured proposal',()=>{const f=fixture();const capture=capturePinTarget(f.collector,'target');expect(capture).not.toBeNull();f.el.setAttribute('disabled','');expect(capture?.valid()).toBe(false);capture?.dispose();});

it('notifies cancellation once when a pending captured node changes, but not on disposal or unrelated DOM',async()=>{
 const f=fixture(),invalidate=vi.fn(),capture=capturePinTarget(f.collector,'target',invalidate);
 document.body.append(document.createElement('div'));await new Promise(resolve=>setTimeout(resolve,0));expect(invalidate).not.toHaveBeenCalled();
 f.el.setAttribute('disabled','');await new Promise(resolve=>setTimeout(resolve,0));expect(invalidate).toHaveBeenCalledTimes(1);expect(capture?.valid()).toBe(false);capture?.dispose();expect(invalidate).toHaveBeenCalledTimes(1);
});
it.each(['scroll','resize'])('cancels a pending capture when %s removes it from the collector viewport',event=>{
 const f=fixture(),invalidate=vi.fn();let visible=true;f.collector.items=()=>visible?[f.item]:[];
 const capture=capturePinTarget(f.collector,'target',invalidate);visible=false;window.dispatchEvent(new Event(event));
 expect(invalidate).toHaveBeenCalledTimes(1);expect(capture?.valid()).toBe(false);capture?.dispose();
});

it.each(['<button type="button" aria-labelledby="label">열기</button><textarea id="label">개인 문장</textarea>','<label><button type="button">열기</button><textarea>개인 문장</textarea></label>'])('does not pin names derived from editable external labels: %s',html=>{
 const f=fixture(html);const button=document.querySelector('button');if(!button)throw new Error('fixture button missing');f.collector.get=()=>button;
 expect(capturePinTarget(f.collector,'target')).toBeNull();
});
