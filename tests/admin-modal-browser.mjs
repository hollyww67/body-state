// Invoke from the documented CUA runtime with an already-open QA confirmation.
// No DELETE is sent. Not a substitute for real installed-PWA device testing.
import assert from 'node:assert/strict';
export default async function verifyModal(tab, viewport) {
  const url = new URL(await tab.url());
  assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '3155', 'QA localhost:3155 only');
  const results = [];
  try {
    for (const [width, height] of [[320,568],[375,667],[390,844],[393,852],[430,932],[844,390],[320,280],[1280,800]]) {
      await viewport.set({ width, height });
      const result = await tab.playwright.getByRole('alertdialog').evaluate(element => ({
        modal: element.matches(':modal'),
        locked: document.body.style.position === 'fixed',
        buttons: [...element.querySelectorAll('button')].map(button => {
          const r = button.getBoundingClientRect();
          return { text: button.textContent, x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom,
            topmost: document.elementFromPoint(r.x+r.width/2, r.y+r.height/2) === button };
        }),
      }));
      assert(result.modal && result.locked);
      for (const button of result.buttons) assert(button.topmost && button.height >= 44 && button.y >= 0 && button.bottom <= height && button.x >= 0 && button.x+button.width <= width+1);
      results.push({ width, height, ...result });
    }
    const dialog = tab.playwright.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).press('Shift+Tab');
    assert.equal(await tab.playwright.evaluate(() => document.activeElement?.textContent), 'Удалить');
    await dialog.getByRole('button', { name: 'Удалить', exact: true }).press('Tab');
    assert.equal(await tab.playwright.evaluate(() => document.activeElement?.textContent), 'Отмена');
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).press('Escape');
    assert.equal(await tab.playwright.getByRole('alertdialog').count(), 0);
    assert.equal(await tab.playwright.evaluate(() => document.body.style.position), '');
    return results;
  } finally { await viewport.reset(); }
};
