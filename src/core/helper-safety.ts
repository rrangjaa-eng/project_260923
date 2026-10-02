// 끄기는 동기화 설정 검사·쓰기 대기열과 독립적이다. 명시적으로 다시 켜기 전 유지한다.
export const HELPER_SAFETY_OFF_KEY = 'helperSafetyOff';
export function isHelperSafetyOff(value: unknown): boolean {
  return value !== undefined && value !== false;
}
