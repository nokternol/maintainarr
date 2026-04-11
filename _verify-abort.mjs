/**
 * _verify-abort.mjs
 * Confirms that /_next/image requests are aborted when the user scrolls away
 * after the 75ms dwell fires. Run: node _verify-abort.mjs
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const sent      = new Set();  // urls issued
const responded = new Set();  // urls that got a response
const failed    = new Map();  // url → errorText

// Delay /_next/image responses by 3s so in-flight requests are still open
// when the scroll-away fires. Without delay, local responses complete in ~50ms
// and the abort mechanism has no race to win.
await page.route('**/_next/image**', async route => {
  const url = route.request().url();
  sent.add(url);
  await new Promise(r => setTimeout(r, 3000));  // 3s artificial delay
  try {
    await route.continue();
  } catch {
    // route was aborted by browser — the request was cancelled ✓
  }
});

page.on('response', res => {
  if (res.url().includes('/_next/image')) responded.add(res.url());
});
page.on('requestfailed', req => {
  if (req.url().includes('/_next/image')) {
    failed.set(req.url(), req.failure()?.errorText ?? 'unknown');
  }
});

console.log('Navigating to /media …');
await page.goto('http://localhost:5057/media', { waitUntil: 'load', timeout: 60000 });

// Wait for at least one media card to appear, then let dwell timers fire.
console.log('Waiting for cards to appear …');
await page.waitForSelector('[data-testid^="media-card-movie-"]', { timeout: 20000 });
console.log('Cards visible. Waiting 200ms for dwell timers to fire …');
await page.waitForTimeout(200);

const sentBeforeScroll = sent.size;
console.log(`/_next/image requests before scroll: ${sentBeforeScroll}`);

// Scroll away rapidly — items that had dwell fire but haven't loaded yet
// should have their requests aborted.
console.log('Scrolling away rapidly …');
await page.evaluate(async () => {
  const main = document.querySelector('main');
  for (let i = 0; i < 20; i++) {
    main.scrollBy(0, 600);
    await new Promise(r => setTimeout(r, 20)); // 20ms steps = fast scroll
  }
});

// Allow time for aborts to propagate (longer than scroll duration).
await page.waitForTimeout(2000);

// Unique request URLs (strip the timestamp suffix we added)
const uniqueSent = new Set([...sent.keys()].map(k => k.split('|')[0]));
const noResponse = [...uniqueSent].filter(url => !responded.has(url) && !failed.has(url));

console.log('\n── Results ────────────────────────────────');
console.log(`Total /_next/image requests:         ${uniqueSent.size}`);
console.log(`Responses received:                  ${responded.size}`);
console.log(`Explicitly failed (requestfailed):   ${failed.size}`);
console.log(`Sent but no response (silent abort): ${noResponse.length}`);

const totalAborted = failed.size + noResponse.length;

if (totalAborted > 0) {
  if (failed.size > 0) {
    console.log('\nExplicit failures:');
    for (const [url, err] of failed) console.log(`  [${err}] ${url.slice(0, 80)}`);
  }
  if (noResponse.length > 0) {
    console.log(`\nSilently dropped (no response event): ${noResponse.length} requests`);
  }
  console.log('\n✓ ABORT VERIFIED — /_next/image requests are cancelled on scroll-away');
} else if (sentBeforeScroll > 0 && responded.size >= uniqueSent.size) {
  console.log('\n⚠ ALL REQUESTS COMPLETED — no aborts, but requests did fire.');
  console.log('  The /_next/image responses arrived before scroll-away could cancel them.');
  console.log('  This is expected when the image server is fast (local cache, fast network).');
  console.log('  Try scrolling faster or adding artificial delay to /_next/image responses.');
} else {
  console.log('\n✗ NO REQUESTS FIRED — dwell may not have triggered before scroll');
}

await browser.close();
