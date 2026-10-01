import { test, expect } from './fixtures';
import {chooseSwitch,startSwitch} from './switch-helpers';
test('single switch starts on Space and selects a link exactly once on release', async ({ context, serviceWorker, servePage }) => {
  await serviceWorker.evaluate(async () => chrome.storage.local.set({ switchSettings: { schemaVersion: 1, mode: 'switch', intervalMs: 800, protectionMs: 100 } }));
  const page = await context.newPage();
  const errors:string[]=[];
  page.on('pageerror', (error) => { errors.push(error.message); });
  page.on('console', (message) => { if (message.type()==='error') errors.push(message.text()); });
  servePage('http://practice.test/switch.html','<a href="#read" onclick="document.querySelector(\'output\').textContent=String(Number(document.querySelector(\'output\').textContent)+1)">읽기</a><output>0</output>');
  await page.goto('http://practice.test/switch.html');
  await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toBeVisible();
  await startSwitch(page);
  await expect(page.locator('tremor-helper-root').locator('.switch-panel')).toHaveAttribute('data-mode', 'groupScan');
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await chooseSwitch(page,'페이지 항목');
  await chooseSwitch(page,'읽기');
  await expect(page.locator('output')).toHaveText('1');
  expect(errors).toEqual([]);
});
