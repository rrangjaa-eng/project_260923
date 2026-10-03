export function pinEligible(el:Element|undefined):boolean{
 if(!el?.isConnected||!(el instanceof HTMLButtonElement&&el.type==='button'||el instanceof HTMLAnchorElement&&['http:','https:'].includes(el.protocol)))return false;
 const editable='input,textarea,select,[contenteditable]:not([contenteditable="false"])';
 if(el.matches(':disabled,[aria-disabled="true"]')||el.querySelector(editable))return false;
 const labels=[...(el instanceof HTMLButtonElement?Array.from(el.labels):[]),...(el.getAttribute('aria-labelledby')??'').split(/\s+/).map(id=>el.ownerDocument.getElementById(id))];
 if(labels.some(label=>label&&(label.closest(editable)||label.querySelector(editable))))return false;
 for(let node:Element|null=el;node;node=node.parentElement){
  if(node instanceof HTMLElement&&(node.isContentEditable||node.hidden||node.inert||node.hasAttribute('contenteditable')&&node.getAttribute('contenteditable')!=='false'))return false;
  const style=getComputedStyle(node);if(style.display==='none'||style.visibility==='hidden')return false;
 }
 return true;
}
