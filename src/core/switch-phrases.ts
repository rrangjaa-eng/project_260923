import { z } from 'zod';
import { characters } from './text-draft';
const text = z.string().min(1).max(1000);
export const PhraseList = z.array(text).max(20);
const existing = { expected: PhraseList, index: z.number().int().nonnegative().max(19) };
export const PhraseMutation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), text }).strict(),
  z.object({ kind: z.literal('replace'), ...existing, text }).strict(),
  z.object({ kind: z.literal('remove'), ...existing }).strict(),
]);
export type PhraseMutation = z.infer<typeof PhraseMutation>;
export function phrasePreviewPages(old: string, replacement?: string): string[] {
  const pages = (label: string, value: string) => {
    const chars = characters(value.replace(/\r\n|\r|\n/g, '↵').replace(/\t/g, '⇥'));
    const count = Math.max(1, Math.ceil(chars.length / 24));
    return Array.from({ length: count }, (_, index) => `${label} ${String(index + 1)}/${String(count)}\n${chars.slice(index * 24, (index + 1) * 24).join('')}`);
  };
  return [...pages('기존 문구', old), ...(replacement === undefined ? [] : pages('바꿀 문장', replacement))];
}
export function changedPhrases(stored: unknown, raw: unknown): string[] | null {
  const list = PhraseList.safeParse(stored === undefined ? [] : stored), mutation = PhraseMutation.safeParse(raw);
  if (!list.success || !mutation.success) return null;
  const value = list.data, change = mutation.data;
  if (change.kind === 'add') return value.includes(change.text) ? value : [...value.slice(-19), change.text];
  if (JSON.stringify(value) !== JSON.stringify(change.expected) || value[change.index] === undefined) return null;
  if (change.kind === 'remove') return value.filter((_, index) => index !== change.index);
  if (value.some((phrase, index) => index !== change.index && phrase === change.text)) return null;
  return value.map((phrase, index) => index === change.index ? change.text : phrase);
}
