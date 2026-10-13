/**
 * E2E: verifikasi alur "sesi berakhir" (401 -> auto logout -> redirect login -> login ulang).
 * Jalankan: node e2e-session.mjs  (butuh backend :5200 & frontend :5173 hidup)
 */
import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const results = [];

function step(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login(page, email, password) {
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.evaluate(() => { document.querySelector('#login-email').value = ''; });
  await page.type('#login-email', email);
  await page.type('#login-password', password);
  await page.click('button.login-submit');
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--window-size=1366,900'],
  defaultViewport: { width: 1366, height: 900 },
});

try {
  const page = await browser.newPage();

  // ===== Langkah 1: buka halaman login =====
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
  step('1. Halaman login terbuka', page.url().includes('/login'), page.url());

  // ===== Langkah 2: login SuperAdmin =====
  await login(page, 'superadmin@desawisata.go.id', 'super123');
  await page.waitForFunction(
    () => window.location.pathname === '/admin',
    { timeout: 20000 },
  );
  step('2. Login sukses, diarahkan ke /admin', page.url().includes('/admin'), page.url());

  // ===== Langkah 3: dashboard memuat data tanpa toast error =====
  await new Promise((r) => setTimeout(r, 3000)); // beri waktu fetch data + polling pertama
  const dashOk = await page.evaluate(() => {
    const text = document.body.innerText;
    const noErrorToast = !text.includes('Gagal memuat data');
    const hasDashboard = text.includes('Desa') || text.includes('Total');
    return { noErrorToast, hasDashboard };
  });
  step(
    '3. Dashboard memuat data tanpa "Gagal memuat data"',
    dashOk.noErrorToast && dashOk.hasDashboard,
    dashOk.noErrorToast && dashOk.hasDashboard ? 'data tampil' : JSON.stringify(dashOk),
  );
  await page.screenshot({ path: 'e2e-1-dashboard.png' });

  // ===== Langkah 4: rusak token (simulasi sesi invalid setelah backend restart) =====
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'tampered.invalid.token');
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });

  // ===== Langkah 5: otomatis diarahkan ke /login dengan pesan sesi berakhir =====
  try {
    await page.waitForFunction(
      () => window.location.pathname === '/login',
      { timeout: 20000 },
    );
    const msgOk = await page.evaluate(() =>
      document.body.innerText.includes('Sesi login Anda telah berakhir'),
    );
    step(
      '5. Token invalid -> redirect /login + pesan "Sesi login Anda telah berakhir"',
      msgOk,
      msgOk ? 'pesan tampil' : 'redirect ok tapi pesan TIDAK tampil',
    );
  } catch {
    const url = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
    step('5. Token invalid -> redirect /login + pesan "Sesi login Anda telah berakhir"', false, `url=${url} | ${bodyText}`);
  }
  await page.screenshot({ path: 'e2e-2-session-expired.png' });

  // ===== Langkah 6: login ulang (redirect param membawa kembali ke /admin) =====
  await login(page, 'superadmin@desawisata.go.id', 'super123');
  await page.waitForFunction(
    () => window.location.pathname === '/admin',
    { timeout: 20000 },
  );
  await new Promise((r) => setTimeout(r, 2500));
  const reloginOk = await page.evaluate(() => !document.body.innerText.includes('Gagal memuat data'));
  step('6. Login ulang sukses, kembali ke /admin tanpa error', reloginOk, page.url());
  await page.screenshot({ path: 'e2e-3-relogin.png' });
} catch (err) {
  step(' Unexpected failure', false, String(err.message || err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== ${results.length - failed}/${results.length} langkah lolos ${failed === 0 ? '✅' : '❌'} ===`);
process.exit(failed === 0 ? 0 : 1);
