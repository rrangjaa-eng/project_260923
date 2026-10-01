import { expect, type Page } from '@playwright/test';
import { INITIALS, MEDIALS, FINALS } from '../../src/core/hangul-compose';
export async function chooseSwitch(page:Page,label:string){
  const panel=page.locator('tremor-helper-root').locator('.switch-panel');
  await expect.poll(async()=>panel.locator('.switch-choice[aria-current="true"]').textContent().catch(()=>''),{timeout:20000,intervals:[100]}).toBe(label);
  await page.keyboard.press('Space');
  await page.waitForTimeout(125);
}
export async function startSwitch(page:Page){
  await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toBeVisible();
  await page.keyboard.press('Space');
  await page.waitForTimeout(125);
}

export async function composeSwitchSyllable(page: Page, initial: string, medial: string, final = '없음') {
  await chooseSwitch(page, '한글 쓰기');
  for (const [characters, character] of [[INITIALS, initial], [MEDIALS, medial], [FINALS, final]] as const) {
    const index = characters.indexOf(character);
    expect(index).toBeGreaterThanOrEqual(0);
    const start = Math.floor(index / 6) * 6;
    await chooseSwitch(page, characters.slice(start, start + 6).join(' '));
    await chooseSwitch(page, character);
  }
}
