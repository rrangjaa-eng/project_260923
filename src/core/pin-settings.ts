import { z } from 'zod';
import { FingerprintSchema, type Fingerprint } from './settings-schema';
import { isSameElement } from './fingerprint';
const NumberSlot=z.number().int().min(1).max(9);
export const PinList=z.array(z.object({number:NumberSlot,fingerprint:FingerprintSchema}).strict()).max(9).refine(pins=>new Set(pins.map(pin=>pin.number)).size===pins.length);
export type PinList=z.infer<typeof PinList>;
export const PinMutation=z.object({number:NumberSlot,expected:PinList,fingerprint:FingerprintSchema.refine(fp=>Object.values(fp).every(value=>typeof value!=='string'||value.length<=1000)&&new TextEncoder().encode(JSON.stringify(fp)).length<=6000).nullable()}).strict();
export type PinMutation=z.infer<typeof PinMutation>;
export function changedPins(current:unknown,raw:unknown):PinList|null{
 const stored=PinList.safeParse(current),mutation=PinMutation.safeParse(raw);
 if(!stored.success||!mutation.success||JSON.stringify(stored.data)!==JSON.stringify(mutation.data.expected))return null;
 const {number,fingerprint}=mutation.data;
 const previous=stored.data.find(pin=>pin.number===number);
 if(fingerprint===null)return previous?stored.data.filter(pin=>pin.number!==number):null;
 if(fingerprint.framePath.length>0||JSON.stringify(previous?.fingerprint)===JSON.stringify(fingerprint)
  ||stored.data.some(pin=>pin.number!==number&&isSameElement(pin.fingerprint,fingerprint)))return null;
 return [...stored.data.filter(pin=>pin.number!==number),{number,fingerprint}].sort((a,b)=>a.number-b.number);
}
export function uniquePinnedTarget<T extends {fingerprint:Fingerprint}>(items:T[],fingerprint:Fingerprint):T|null{
 const matches=items.filter(item=>isSameElement(item.fingerprint,fingerprint)
  &&(!fingerprint.id||item.fingerprint.id===fingerprint.id)&&(!fingerprint.name||item.fingerprint.name===fingerprint.name)
  &&(!!fingerprint.id||!!fingerprint.name||item.fingerprint.domPath===fingerprint.domPath));return matches.length===1?matches[0]??null:null;
}

export function pinName(fingerprint:Fingerprint):string{return fingerprint.aria||fingerprint.labelText||fingerprint.buttonText||fingerprint.name||fingerprint.id||'저장된 대상';}
