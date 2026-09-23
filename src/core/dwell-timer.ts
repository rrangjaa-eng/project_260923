// 머무르기 클릭 상태 기계(D-12): 잡힌 대상 위에 dwellMs만큼 머물면 진행이 0→1로 오르고 1에
// 닿는 첫 update에서만 fire한다. 같은 대상에 계속 머물러도 다시 fire하지 않지만, 대상이
// null(떠남)이 되었다가 같은 대상으로 돌아오면 처음부터 다시 진행한다. danger 대상은 늘 진행
// 0이고 발사하지 않는다(D-18). 순수 함수 — document·window·chrome을 참조하지 않는다.

export interface DwellUpdate {
  targetId: string | null;
  danger: boolean;
  t: number;
}

export interface DwellResult {
  progress: number;
  fire: boolean;
}

export interface DwellTimer {
  update(s: DwellUpdate): DwellResult;
}

export function createDwellTimer({ dwellMs }: { dwellMs: number }): DwellTimer {
  let trackedTargetId: string | null = null;
  let startedAt = 0;
  let fired = false;

  return {
    update({ targetId, danger, t }) {
      if (targetId !== trackedTargetId) {
        trackedTargetId = targetId;
        startedAt = t;
        fired = false;
      }

      if (targetId === null || danger) {
        return { progress: 0, fire: false };
      }

      if (fired) {
        return { progress: 1, fire: false };
      }

      const progress = Math.min(1, (t - startedAt) / dwellMs);
      if (progress >= 1) {
        fired = true;
        return { progress: 1, fire: true };
      }
      return { progress, fire: false };
    },
  };
}
