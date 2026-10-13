/** Verifikasi visual navbar: bar full-width + pill aktif pindah saat klik Destinasi/Peta. */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  defaultViewport: { width: 1366, height: 800 },
});
const page = await browser.newPage();

try {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));

  // 1) Kondisi awal: Beranda aktif + hero hijau naik di belakang navbar
  const s1 = await page.evaluate(() => {
    const bar = document.querySelector('.nav2-inner');
    const active = document.querySelector('.nav2-link.active .nav2-link-label');
    const hero = document.querySelector('.hero2')?.getBoundingClientRect();
    const nav = document.querySelector('.nav2')?.getBoundingClientRect();
    return {
      activeLabel: active?.textContent ?? null,
      barWidth: bar ? Math.round(bar.getBoundingClientRect().width) : 0,
      viewport: window.innerWidth,
      heroTop: hero ? Math.round(hero.top) : null,
      navTop: nav ? Math.round(nav.top) : null,
    };
  });
  console.log('[1] awal       :', JSON.stringify(s1));
  await page.screenshot({ path: 'nav-1-beranda.png', clip: { x: 0, y: 0, width: 1366, height: 160 } });

  // 2) Klik Destinasi -> pill pindah + smooth scroll ke #wisata
  await page.evaluate(() => {
    const links = [...document.querySelectorAll('.nav2-link')];
    links.find((l) => l.textContent?.includes('Destinasi'))?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
  });
  await new Promise((r) => setTimeout(r, 1800));
  const s2 = await page.evaluate(() => {
    const active = document.querySelector('.nav2-link.active .nav2-link-label');
    const sec = document.getElementById('wisata')?.getBoundingClientRect();
    return { activeLabel: active?.textContent ?? null, wisataTop: sec ? Math.round(sec.top) : null, scrollY: Math.round(window.scrollY) };
  });
  console.log('[2] destinasi  :', JSON.stringify(s2));
  await page.screenshot({ path: 'nav-2-destinasi.png', clip: { x: 0, y: 0, width: 1366, height: 120 } });

  // 3) Klik Peta -> pill pindah lagi + scroll ke #peta
  await page.evaluate(() => {
    const links = [...document.querySelectorAll('.nav2-link')];
    links.find((l) => l.textContent?.includes('Peta'))?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
  });
  await new Promise((r) => setTimeout(r, 1800));
  const s3 = await page.evaluate(() => {
    const active = document.querySelector('.nav2-link.active .nav2-link-label');
    const sec = document.getElementById('peta')?.getBoundingClientRect();
    return { activeLabel: active?.textContent ?? null, petaTop: sec ? Math.round(sec.top) : null };
  });
  console.log('[3] peta       :', JSON.stringify(s3));
  await page.screenshot({ path: 'nav-3-peta.png', clip: { x: 0, y: 0, width: 1366, height: 120 } });

  // Verifikasi: hero hijau harus naik di belakang navbar (heroTop <= 0 saat di atas)
  const ok1 = s1.activeLabel === 'Beranda' && s1.heroTop !== null && s1.heroTop <= 0 && s1.navTop >= 0;
  const ok2 = s2.activeLabel === 'Destinasi' && s2.wisataTop !== null && s2.wisataTop >= 0 && s2.wisataTop < 200;
  const ok3 = s3.activeLabel === 'Peta' && s3.petaTop !== null && s3.petaTop >= 0 && s3.petaTop < 200;
  console.log(`\n${ok1 ? 'PASS' : 'FAIL'}  hero hijau di belakang navbar (heroTop=${s1.heroTop}, navTop=${s1.navTop})`);
  console.log(`${ok2 ? 'PASS' : 'FAIL'}  klik Destinasi -> pill pindah & scroll ke #wisata (top=${s2.wisataTop})`);
  console.log(`${ok3 ? 'PASS' : 'FAIL'}  klik Peta -> pill pindah & scroll ke #peta (top=${s3.petaTop})`);
  process.exit(ok1 && ok2 && ok3 ? 0 : 1);
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
} finally {
  await browser.close();
}
