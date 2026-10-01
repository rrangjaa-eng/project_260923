import { ensureOverlayRoot } from './mode-indicator';
import type { SwitchState } from '@/core/switch-engine';
export function createSwitchPanel() {
  const root = ensureOverlayRoot();
  const style = document.createElement('style');
  style.textContent = `
.switch-panel{position:fixed;right:var(--space-4);top:var(--space-4);width:min(420px,calc(100vw - 32px));max-height:70vh;display:flex;flex-direction:column;overflow:hidden;pointer-events:auto;background:var(--bg);color:var(--fg);border:var(--border-strong) solid var(--accent);border-radius:var(--radius-card);padding:var(--space-3);font-family:var(--font);font-size:var(--text-body);line-height:var(--leading);box-sizing:border-box;transform-origin:top right;transform:scale(var(--overlay-scale,1))}
.switch-panel h2{flex-shrink:0;font-size:var(--text-body);margin:0 0 var(--space-2);font-weight:var(--weight-bold)}
.switch-choices{display:grid;gap:var(--space-2);min-height:0;overflow:auto}
.switch-choice{min-height:var(--target-min);padding:var(--space-2);border:var(--border-strong) solid transparent;border-radius:var(--radius-button);background:var(--surface);color:var(--fg);font:inherit;text-align:left;box-sizing:border-box}
.switch-choice[aria-current=true]{border-color:var(--accent);font-weight:var(--weight-bold)}
.switch-choice[aria-disabled=true]{color:var(--muted)}
.switch-draft{flex-shrink:0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:120px;overflow:auto;margin:var(--space-2) 0}
.switch-status{flex-shrink:0;margin:var(--space-2) 0;font-size:var(--text-sm);color:var(--warning)}
`;
  const panel = document.createElement('section'); panel.className='switch-panel'; panel.setAttribute('aria-label','스페이스바 작업판');
  root.append(style,panel);
  return {
    render(state: SwitchState, heading: string, preview: string, notice: string) {
      panel.dataset.mode=state.mode;
      panel.replaceChildren();
      const title=document.createElement('h2'); title.textContent=heading; panel.append(title);
      const status=document.createElement('p'); status.className='switch-status';
      status.textContent = notice || (state.mode==='ready'?'스페이스바로 시작':state.mode==='paused'?'쉬는 중 · 스페이스바로 재개':state.mode==='recovering'?'결과 확인 필요 · 스페이스바로 재개':state.mode==='scrolling'?'스페이스바로 정지':'스페이스바로 선택');
      status.setAttribute('role','status'); panel.append(status);
      if(preview){const text=document.createElement('p');text.className='switch-draft';text.textContent=preview;panel.append(text);}
      const list=document.createElement('div');list.className='switch-choices';list.setAttribute('role','list');
      state.items.forEach((item,index)=>{const el=document.createElement('div');el.className='switch-choice';el.dataset.itemId=item.id;el.textContent=item.label;
        el.setAttribute('role','listitem');el.setAttribute('aria-current',String(index===state.scanIndex && !['paused','ready','recovering','executing','scrolling'].includes(state.mode)));el.setAttribute('aria-disabled',String(!!item.disabled));list.append(el);});
      panel.append(list);
      const selected=list.querySelector('[aria-current="true"]');
      if(selected instanceof HTMLElement){
        const choice=selected.getBoundingClientRect(),bounds=list.getBoundingClientRect();
        if(choice.bottom>bounds.bottom)list.scrollTop+=choice.bottom-bounds.bottom+12;
        else if(choice.top<bounds.top)list.scrollTop-=bounds.top-choice.top+12;
      }
    },
    destroy(){panel.remove();style.remove();},
  };
}
