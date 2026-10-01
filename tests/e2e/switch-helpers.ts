import { expect, type Page } from '@playwright/test';
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
