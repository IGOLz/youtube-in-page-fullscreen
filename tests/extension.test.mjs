import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const extension = fileURLToPath(new URL('../extension', import.meta.url));
const fixture = `<!doctype html><html><head><style>
  body { margin: 0; height: 2500px; }
  #shell { transform: translateZ(0); overflow: hidden; width: 800px; }
  #masthead, #playlist { position: fixed; top: 0; z-index: 2147483647; background: white; }
  #playlist { right: 0; width: 300px; height: 500px; }
  #movie_player { position: relative; width: 640px; height: 360px; background: black; }
  video { position: absolute; width: 640px; height: 360px; }
  .ytp-chrome-bottom { position: absolute; bottom: 0; }
  .ytp-button { width: 48px; height: 48px; color: white; }
</style></head><body>
  <header id="masthead"><button>Search YouTube</button></header>
  <input aria-label="Search"><div contenteditable="true" role="textbox">Comment</div>
  <div id="shell"><aside id="playlist"><button>Next video</button></aside><div id="movie_player" tabindex="0">
    <div class="html5-video-container"><video class="html5-main-video"></video></div>
    <div class="ytp-chrome-bottom"><div class="ytp-right-controls">
      <span><button class="ytp-fullscreen-button">Native</button></span>
    </div></div>
  </div><section id="details">Video description and comments</section></div>
  <script>
    window.nativeKeys = 0;
    document.addEventListener('keydown', e => { if (e.key === 'f') window.nativeKeys++; });
    document.querySelector('.ytp-fullscreen-button').onclick = () => document.querySelector('#movie_player').requestFullscreen();
  </script>
</body></html>`;

test('unpacked extension in Chromium/Brave', async t => {
  const profile = await mkdtemp(path.join(tmpdir(), 'yipf-test-'));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.BROWSER_PATH || undefined,
    channel: process.env.BROWSER_PATH ? undefined : 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    const page = context.pages()[0];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://www.youtube.com/watch?v=test');
    await page.waitForSelector('#yipf-toggle');
    const active = () => page.locator('html').evaluate(el => el.classList.contains('yipf-active'));

    await t.test('F fills the viewport, keeps the player in place and never requests native fullscreen', async () => {
      await page.keyboard.press('f');
      assert.equal(await active(), true);
      assert.deepEqual(await page.locator('#movie_player').boundingBox(), { x: 0, y: 0, width: 1280, height: 800 });
      assert.deepEqual(await page.locator('video').boundingBox(), { x: 0, y: 0, width: 1280, height: 800 });
      assert.equal(await page.evaluate(() => document.fullscreenElement), null);
      assert.equal(await page.locator('#movie_player').evaluate(el => el.parentElement.id), 'shell');
      assert.equal(await page.evaluate(() => window.nativeKeys), 0);
      await page.setViewportSize({ width: 1100, height: 700 });
      assert.deepEqual(await page.locator('#movie_player').boundingBox(), { x: 0, y: 0, width: 1100, height: 700 });
      await page.keyboard.press('Escape');
      assert.equal(await active(), false);
      assert.equal((await page.locator('#movie_player').boundingBox()).width, 640);
    });

    await t.test('typing, modifier keys and repeated keys do not toggle', async () => {
      await page.getByRole('textbox', { name: 'Search' }).focus();
      await page.keyboard.press('f');
      assert.equal(await active(), false);
      await page.getByRole('textbox').nth(1).focus();
      await page.keyboard.press('f');
      assert.equal(await active(), false);
      await page.locator('#movie_player').focus();
      await page.keyboard.press('Control+f');
      assert.equal(await active(), false);
      await page.keyboard.down('f');
      await page.keyboard.down('f');
      assert.equal(await active(), true);
      await page.keyboard.up('f');
      await page.keyboard.press('Escape');
    });

    await t.test('expanded view hides page content and new overlays, then restores everything', async () => {
      const outside = page.locator('#masthead, #playlist, #details');
      assert.deepEqual(await outside.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).display === 'none')), [false, false, false]);
      await page.locator('#movie_player').focus();
      await page.keyboard.press('f');
      assert.deepEqual(await outside.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).display)), ['none', 'none', 'none']);
      assert.equal(await page.getByRole('button', { name: 'Next video' }).count(), 0);
      await page.evaluate(() => {
        const panel = document.createElement('aside');
        panel.id = 'dynamic-panel';
        panel.innerHTML = '<button style="visibility:visible!important">New panel</button>';
        document.getElementById('shell').append(panel);
        const banner = document.createElement('div');
        banner.id = 'dynamic-banner';
        banner.textContent = 'New page overlay';
        document.body.append(banner);
      });
      assert.equal(await page.locator('#dynamic-panel').evaluate(el => getComputedStyle(el).display), 'none');
      assert.equal(await page.locator('#dynamic-banner').evaluate(el => getComputedStyle(el).display), 'none');
      assert.equal(await page.getByRole('button', { name: 'New panel' }).count(), 0);
      assert.equal(await page.locator('#yipf-toggle').isVisible(), true);
      await page.keyboard.press('Escape');
      assert.deepEqual(await outside.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).display === 'none')), [false, false, false]);
      assert.equal(await page.getByRole('button', { name: 'Next video' }).isVisible(), true);
      assert.equal(await page.getByRole('button', { name: 'New panel' }).isVisible(), true);
      await page.locator('#dynamic-panel').evaluate(el => el.remove());
      await page.locator('#dynamic-banner').evaluate(el => el.remove());
      // The fixture's overlays deliberately overlap the player only in this regression test.
      await page.addStyleTag({ content: '#masthead, #playlist { position: static; }' });
    });

    await t.test('custom button and double click toggle; exit restores focus and scroll', async () => {
      await page.locator('#yipf-toggle').click();
      assert.equal(await active(), true);
      assert.equal(await page.locator('#yipf-toggle').getAttribute('aria-pressed'), 'true');
      await page.locator('#yipf-toggle').click();
      assert.equal(await active(), false);
      await page.locator('video').dblclick({ position: { x: 100, y: 100 } });
      assert.equal(await active(), true);
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.scrollTo(0, 200));
      await page.locator('#movie_player').focus();
      const scroll = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('f');
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => window.scrollY), scroll);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'movie_player');
      await page.evaluate(() => window.scrollTo(0, 0));
    });

    await t.test('native fullscreen button remains available', async () => {
      await page.locator('#yipf-toggle').click();
      await page.locator('.ytp-fullscreen-button').click();
      await page.waitForFunction(() => document.fullscreenElement !== null);
      await page.waitForFunction(() => !document.documentElement.classList.contains('yipf-active'));
      await page.evaluate(() => document.exitFullscreen());
      await page.waitForFunction(() => document.fullscreenElement === null);
    });

    await t.test('reparenting the player exits safely and restores its new branch', async () => {
      await page.locator('#yipf-toggle').click();
      await page.evaluate(() => {
        const wrapper = document.createElement('section');
        wrapper.id = 'new-layout';
        document.getElementById('shell').append(wrapper);
        wrapper.append(document.getElementById('movie_player'));
      });
      await page.waitForFunction(() => !document.documentElement.classList.contains('yipf-active'));
      assert.equal(await page.locator('.yipf-ancestor').count(), 0);
      assert.equal(await page.locator('#movie_player').isVisible(), true);
      await page.locator('#yipf-toggle').click();
      assert.equal(await active(), true);
      assert.deepEqual(await page.locator('#movie_player').boundingBox(), { x: 0, y: 0, width: 1100, height: 700 });
      await page.keyboard.press('Escape');
    });

    await t.test('SPA navigation cleans up, replacement player gets exactly one button', async () => {
      await page.locator('#yipf-toggle').click();
      await page.evaluate(() => {
        document.dispatchEvent(new Event('yt-navigate-start'));
        history.pushState({}, '', '/');
        document.dispatchEvent(new Event('yt-navigate-finish'));
      });
      await page.waitForFunction(() => !document.getElementById('yipf-toggle'));
      assert.equal(await active(), false);
      assert.equal(await page.locator('.yipf-ancestor').count(), 0);
      await page.keyboard.press('f');
      assert.equal(await active(), false);
      await page.evaluate(() => {
        history.pushState({}, '', '/watch?v=second');
        document.dispatchEvent(new Event('yt-navigate-finish'));
      });
      await page.waitForSelector('#yipf-toggle');
      await page.locator('#yipf-toggle').click();
      await page.evaluate(() => {
        const old = document.getElementById('movie_player');
        const next = old.cloneNode(true);
        next.classList.remove('yipf-player');
        next.querySelector('#yipf-toggle').remove();
        old.replaceWith(next);
      });
      await page.waitForFunction(() => !document.documentElement.classList.contains('yipf-active'));
      await page.waitForSelector('#yipf-toggle');
      assert.equal(await page.locator('#yipf-toggle').count(), 1);
      await page.locator('#yipf-toggle').click();
      assert.equal(await active(), true);
      await page.keyboard.press('Escape');
    });
    assert.deepEqual(errors, []);
    const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
    assert.equal(manifest.permissions, undefined);
    assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.youtube.com/*']);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
