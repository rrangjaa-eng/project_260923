import type {Rect} from '@/core/grid-index';

export interface ScrollRegion {
  element: HTMLElement;
  label: string;
  page: boolean;
  epoch: number;
  identity: string;
  body: HTMLElement;
  url: string;
}

// Only current top-document native vertical regions; never read their content or values.
export function createScrollRegions() {
  const epochs=new WeakMap<HTMLElement,number>();
  const tracked=new Set<HTMLElement>();
  const name=(el:HTMLElement)=>((el.getAttribute('aria-label')??'').trim().replace(/\s+/g,' ')).slice(0,80);
  const identity=(el:HTMLElement)=>JSON.stringify([el.id,el.getAttribute('role'),el.getAttribute('aria-label'),el.getAttribute('aria-labelledby')]);
  function changes(records:MutationRecord[]){
    for(const record of records)for(const el of tracked){
      const removed=Array.from(record.removedNodes).some(node=>node===el||node.contains(el));
      if(removed||record.type==='attributes'&&(record.target===el||record.target.contains(el))){epochs.set(el,(epochs.get(el)??0)+1);if(removed)tracked.delete(el);}
    }
  }
  const observer=new MutationObserver(changes);
  observer.observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','inert','aria-hidden','aria-label','aria-labelledby','role']});
  function visible(el:HTMLElement):Rect|null {
    if(!el.isConnected||el.ownerDocument!==document||el.getRootNode()!==document||el.closest('tremor-helper-root,input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return null;
    const box=el.getBoundingClientRect();let left=Math.max(0,box.left),top=Math.max(0,box.top),right=Math.min(innerWidth,box.right),bottom=Math.min(innerHeight,box.bottom);
    for(let node:HTMLElement|null=el;node;node=node.parentElement){
      const style=getComputedStyle(node);
      if(node.hidden||node.inert||node.getAttribute('aria-hidden')==='true'||style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||style.opacity==='0')return null;
      if(node!==el&&node!==document.body&&node!==document.documentElement){
        const rect=node.getBoundingClientRect();
        if(/auto|scroll|hidden|clip/.test(style.overflowX)){left=Math.max(left,rect.left);right=Math.min(right,rect.right);}
        if(/auto|scroll|hidden|clip/.test(style.overflowY)){top=Math.max(top,rect.top);bottom=Math.min(bottom,rect.bottom);}
      }
    }
    return right>left&&bottom>top?{x:left,y:top,w:right-left,h:bottom-top}:null;
  }
  const supported=(el:HTMLElement)=>/^(auto|scroll|overlay)$/.test(getComputedStyle(el).overflowY)&&el.clientHeight>0&&el.scrollHeight>el.clientHeight+1&&visible(el)!==null;
  function snapshot(el:HTMLElement,label:string,page=false):ScrollRegion {
    changes(observer.takeRecords());tracked.add(el);
    return {element:el,label,page,epoch:epochs.get(el)??0,identity:identity(el),body:document.body,url:location.href};
  }
  function page():ScrollRegion|null {const el=document.scrollingElement;return el instanceof HTMLElement?snapshot(el,'페이지 전체',true):null;}
  function valid(region:ScrollRegion):boolean {
    changes(observer.takeRecords());const el=region.element;
    if(document.hidden||!el.isConnected||el.ownerDocument!==document||region.body!==document.body||region.url!==location.href||region.epoch!==(epochs.get(el)??0)||region.identity!==identity(el))return false;
    if(!region.page)return supported(el);
    return el===document.scrollingElement&&[document.documentElement,document.body].every(node=>{
      const style=getComputedStyle(node);
      return !node.hidden&&!node.inert&&node.getAttribute('aria-hidden')!=='true'&&style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse'&&style.opacity!=='0'&&!/^(hidden|clip)$/.test(style.overflowY);
    });
  }
  return {
    page,valid,
    discover():ScrollRegion[]{
      const root=page();const regions=root?[root]:[];let index=0;
      for(const el of document.querySelectorAll<HTMLElement>('*'))if(el instanceof HTMLElement&&el!==document.scrollingElement&&el!==document.body&&supported(el)){
        index++;regions.push(snapshot(el,`영역 ${String(index)} · ${name(el)||'이름 없는 영역'}`));
      }
      return regions;
    },
    rect(region:ScrollRegion):Rect|null {return valid(region)&&!region.page?visible(region.element):null;},
    step(region:ScrollRegion,direction:'up'|'down',automatic=false):'moved'|'end'|'stale'|'blocked'{
      if(!valid(region))return 'stale';
      const el=region.element,from=el.scrollTop,max=Math.max(0,el.scrollHeight-el.clientHeight);
      const distance=automatic?2:(region.page?innerHeight:el.clientHeight)*0.8;
      const to=Math.max(0,Math.min(max,from+(direction==='up'?-distance:distance)));
      if(Math.abs(to-from)<0.5)return 'end';
      el.scrollTo({top:to,behavior:'instant'});return Math.abs(el.scrollTop-from)<0.5?'blocked':'moved';
    },
    destroy(){observer.disconnect();tracked.clear();},
  };
}
