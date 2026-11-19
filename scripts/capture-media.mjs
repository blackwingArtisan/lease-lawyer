// Captures the README media from a running build: the first-visit tour as a GIF, plus three stills.
//   npm run build && npx vite preview --port 3711 --strictPort &
//   node scripts/capture-media.mjs [http://localhost:3711/]
// Needs ffmpeg on the PATH for the GIF.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3711/';
const out = 'docs/media';
const browser = await chromium.launch();

async function still(name, viewport, lease, topic) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(`${base}?tour=off`);
  await page.getByTestId(`lease-${lease}`).click();
  await page.getByTestId('fact-count').filter({ hasText: 'facts extracted' }).waitFor();
  await page.getByRole('button', { name: topic, exact: true }).click();
  await page.getByTestId('stamp').waitFor();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(out, name) });
  await page.close();
}

await still('verdict-no.png', { width: 1440, height: 900 }, 'gaslight-row', 'Deposit and wear and tear');
await still('cant-tell.png', { width: 1440, height: 900 }, 'hollowmere-flats', 'Pets and assistance animals');
await still('phone.png', { width: 390, height: 844 }, 'gaslight-row', 'Deposit and wear and tear');

// The tour, recorded as video and converted to a palette GIF.
const videoDir = await mkdtemp(join(tmpdir(), 'lease-lawyer-tour-'));
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } } });
const page = await context.newPage();
await page.goto(`${base}?tour=on`);
await page.getByTestId('tour').filter({ hasText: 'Tour 5 of 5' }).waitFor({ timeout: 40_000 });
await page.waitForTimeout(3500);
await context.close();
const [video] = (await readdir(videoDir)).filter((f) => f.endsWith('.webm'));
execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error', '-ss', '0.6', '-i', join(videoDir, video),
  '-vf', 'fps=6,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  join(out, 'tour.gif'),
]);
await rm(videoDir, { recursive: true });
await browser.close();
console.log(`wrote ${out}/tour.gif, verdict-no.png, cant-tell.png, phone.png`);
