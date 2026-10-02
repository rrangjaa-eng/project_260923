export function createActionGate(documentGeneration: string) {
  const seen = new Set<string>();
  let pending: string | null = null;
  return {
    accept(actionId: string, generation: string): boolean {
      if (generation !== documentGeneration || pending !== null || seen.has(actionId)) return false;
      seen.add(actionId); pending = actionId;
      return true;
    },
    finish(actionId: string): void { if (pending === actionId) pending = null; },
  };
}
