import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = process.env.LIVE_API_URL || 'http://127.0.0.1:5099';
const SHORT = process.env.LIVE_SHORT_API_URL || 'http://127.0.0.1:5100';
const UI = process.env.LIVE_FRONTEND_URL || 'http://127.0.0.1:5181';
const STUDENT = '20152691234567890';
type Course = { id: string; name: string; totalSeats: number; heldSeats: number; confirmedSeats: number; availableSeats: number };
type Hold = { holdId: string; classId: string; studentId: string; status: string; expiresAt: string };
let service: APIRequestContext;
let sequence = 0;
const courses: Course[] = [];
const browserErrors: string[] = [];
const student = () => (90110000000000000n + BigInt(++sequence)).toString();
const headers = (id: string) => ({ 'X-Student-Id': id });
async function create(name: string, totalSeats = 3): Promise<Course> {
  const response = await service.post(API + '/classes', { data: { name, totalSeats } });
  expect(response.status()).toBe(201);
  return response.json();
}
async function reserve(course: Course, id: string, short = false): Promise<Hold> {
  const response = await service.post((short ? SHORT : API) + '/classes/' + course.id + '/holds', { headers: headers(id) });
  expect(response.status()).toBe(201);
  return response.json();
}
async function confirm(hold: Hold, id = hold.studentId, host = API) {
  const response = await service.post(host + '/holds/' + hold.holdId + '/confirm', { headers: headers(id) });
  expect(response.status()).toBe(200);
}
async function cancel(hold: Hold) {
  const response = await service.delete(API + '/holds/' + hold.holdId, { headers: headers(hold.studentId) });
  expect(response.status()).toBe(204);
}
async function summary(course: Course): Promise<Course> {
  return (await service.get(API + '/classes/' + course.id)).json();
}
async function identity(page: Page, id: string, path = '/') {
  await page.addInitScript(value => localStorage.setItem('school-admission-student-id', value), id);
  await page.goto(UI + path);
}
async function holdScreen(page: Page, course: Course, id: string) {
  await identity(page, id, '/apply/' + course.id);
  await page.getByRole('button', { name: 'Reserve my seat', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
}

test.beforeAll(async ({ playwright }) => {
  service = await playwright.request.newContext();
  const definitions: [string, number][] = [
    ['Class 6 - Morning Shift', 12], ['Class 6 - Day Shift', 8],
    ['Class 7 - Morning Shift', 3], ['Class 8 - Day Shift', 6],
    ['Class 9 - Science', 10], ['Class 10 - Day Shift', 5],
  ];
  for (const [name, seats] of definitions) courses.push(await create(name, seats));
  await confirm(await reserve(courses[0], STUDENT));
  for (let n = 0; n < 3; n++) await confirm(await reserve(courses[0], student()));
  for (let n = 0; n < 2; n++) await reserve(courses[0], student());
  await reserve(courses[1], STUDENT);
  for (let n = 0; n < 2; n++) await confirm(await reserve(courses[1], student()));
  for (let n = 0; n < 3; n++) await confirm(await reserve(courses[2], student()));
  await cancel(await reserve(courses[3], STUDENT));
  for (let n = 0; n < 2; n++) await confirm(await reserve(courses[4], student()));
  const expiring = await reserve(courses[4], STUDENT, true);
  await expect.poll(async () => (await (await service.get(API + '/holds/' + expiring.holdId)).json()).status, { timeout: 12000 }).toBe('EXPIRED');
  const seeded = await (await service.get(API + '/classes')).json();
  const history = await (await service.get(API + '/me/holds', { headers: headers(STUDENT) })).json();
  expect(history.map((h: Hold) => h.status).sort()).toEqual(['CANCELLED', 'CONFIRMED', 'EXPIRED', 'HELD']);
  mkdirSync(resolve('test-results-live'), { recursive: true });
  writeFileSync(resolve('test-results-live/seed-summary.json'), JSON.stringify({ syntheticStudentId: STUDENT, classes: seeded, applications: history }, null, 2));
});
test.afterAll(async () => { await service.dispose(); });
test.beforeEach(async ({ page }) => {
  browserErrors.length = 0;
  page.on('pageerror', error => browserErrors.push(error.message));
});
test.afterEach(() => { expect(browserErrors, 'Unhandled browser errors').toEqual([]); });

test('real seeded directory has six classes, exact seat totals, filters and full state', async ({ page }, info) => {
  await page.goto(UI);
  await expect(page.locator('.class-card')).toHaveCount(6);
  await expect(page.locator('.summary-card').first()).toContainText('30');
  const full = page.locator('.class-card').filter({ hasText: courses[2].name });
  await expect(full.getByRole('button', { name: 'All seats are reserved' })).toBeDisabled();
  await page.getByRole('searchbox').fill('Morning');
  await expect(page.locator('.class-card')).toHaveCount(2);
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'Available', exact: true }).click();
  await expect(page.locator('.class-card')).toHaveCount(5);
  await page.getByRole('button', { name: 'All classes', exact: true }).click();
  await page.screenshot({ path: info.outputPath('real-data-directory-desktop.png'), fullPage: true });
});

test('real student history contains all four statuses and filters correctly', async ({ page }, info) => {
  await identity(page, STUDENT, '/me');
  await expect(page.locator('.application-row')).toHaveCount(4);
  for (const [filter, text] of [['Active', 'Seat held'], ['Confirmed', 'Confirmed'], ['Closed', '']] as const) {
    await page.getByRole('button', { name: new RegExp('^' + filter) }).click();
    await expect(page.locator('.application-row')).toHaveCount(filter === 'Closed' ? 2 : 1);
    if (text) await expect(page.locator('.application-row .status-badge')).toHaveText(text);
  }
  await page.getByRole('button', { name: /^All/ }).click();
  await page.screenshot({ path: info.outputPath('real-data-all-statuses.png'), fullPage: true });
});

test('class creation, hold, page reopen, confirmation and database counts agree', async ({ page }, info) => {
  const id = student();
  await identity(page, id, '/admin/create');
  const name = 'UI-created Class 11 - Morning Shift';
  await page.getByLabel('Class name', { exact: true }).fill(name);
  await page.getByLabel('Total seats', { exact: true }).fill('2');
  await page.screenshot({ path: info.outputPath('real-data-create-class.png'), fullPage: true });
  await page.getByRole('button', { name: 'Create class', exact: true }).click();
  const card = page.locator('.class-card').filter({ hasText: name });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: 'Apply for a seat' }).click();
  await page.getByRole('button', { name: 'Reserve my seat' }).click();
  await expect(page).toHaveURL(/holdId=/);
  await expect(page.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  const url = page.url();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('real-data-held.png'), fullPage: true });
  const reopened = await page.context().newPage();
  await reopened.goto(url);
  await expect(reopened.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  await reopened.getByRole('button', { name: 'Complete mock payment', exact: true }).click();
  await expect(reopened.getByRole('heading', { name: 'Admission confirmed!' })).toBeVisible();
  await reopened.screenshot({ path: info.outputPath('real-data-confirmed.png'), fullPage: true });
  const courseId = new URL(url).pathname.split('/').pop()!;
  const current = await (await service.get(API + '/classes/' + courseId)).json();
  expect([current.heldSeats, current.confirmedSeats, current.availableSeats]).toEqual([0, 1, 1]);
  await reopened.close();
});

test('two students compete for last seat; loser gets conflict and counts stay correct', async ({ browser }) => {
  const course = await create('Last seat competition', 1);
  const a = await browser.newContext(); const b = await browser.newContext();
  try {
    const pa = await a.newPage(); const pb = await b.newPage();
    await Promise.all([identity(pa, student(), '/apply/' + course.id), identity(pb, student(), '/apply/' + course.id)]);
    const ra = pa.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/classes/' + course.id + '/holds'));
    const rb = pb.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/classes/' + course.id + '/holds'));
    await Promise.all([pa.getByRole('button', { name: 'Reserve my seat' }).click(), pb.getByRole('button', { name: 'Reserve my seat' }).click()]);
    const responses = await Promise.all([ra, rb]);
    expect(responses.map(r => r.status()).sort()).toEqual([201, 409]);
    const loser = responses[0].status() === 409 ? pa : pb;
    await expect(loser.getByRole('alert')).toContainText('No seats available');
    const count = await summary(course);
    expect([count.heldSeats, count.confirmedSeats, count.availableSeats]).toEqual([1, 0, 0]);
  } finally { await a.close(); await b.close(); }
});

test('another student reservation and cancellation update open directory without reload', async ({ page }) => {
  const course = await create('Live seat polling', 2);
  await page.goto(UI);
  const card = page.locator('.class-card').filter({ hasText: course.name });
  await expect(card.locator('.seat-count strong')).toHaveText('2');
  const held = await reserve(course, student());
  await expect(card.locator('.seat-count strong')).toHaveText('1');
  await cancel(held);
  await expect(card.locator('.seat-count strong')).toHaveText('2');
});

test('other-tab confirmation wins over an open cancel prompt', async ({ page }) => {
  const course = await create('Two-tab confirmation', 1);
  await holdScreen(page, course, student());
  const second = await page.context().newPage();
  await second.goto(page.url());
  await expect(second.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  await second.getByRole('button', { name: 'Cancel reservation', exact: true }).click();
  await page.getByRole('button', { name: 'Complete mock payment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admission confirmed!' })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Admission confirmed!' })).toBeVisible();
  await expect(second.getByRole('button', { name: 'Yes, cancel reservation' })).toHaveCount(0);
  expect((await summary(course)).confirmedSeats).toBe(1);
  await second.close();
});

test('other-tab cancellation removes stale payment action', async ({ page }) => {
  const course = await create('Two-tab cancellation', 1);
  await holdScreen(page, course, student());
  const second = await page.context().newPage();
  await second.goto(page.url());
  await expect(second.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel reservation', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, cancel reservation', exact: true }).click();
  await expect(second.getByRole('heading', { name: 'Reservation cancelled', exact: true })).toBeVisible();
  await expect(second.getByRole('button', { name: 'Complete mock payment', exact: true })).toHaveCount(0);
  expect((await summary(course)).availableSeats).toBe(1);
  await second.close();
});

for (const action of ['apply', 'confirm', 'cancel'] as const) {
  test('lost ' + action + ' response recovers actual committed state without duplicate mutation', async ({ page }) => {
    const course = await create('Lost ' + action + ' response', 2);
    const id = student();
    let held: Hold | null = null;
    if (action !== 'apply') held = await reserve(course, id);
    const path = action === 'apply' ? '/classes/' + course.id + '/holds'
      : '/holds/' + held!.holdId + (action === 'confirm' ? '/confirm' : '');
    const method = action === 'cancel' ? 'DELETE' : 'POST';
    let dropped = false;
    await page.route(API + path, async route => {
      if (route.request().method() !== method || dropped) return route.continue();
      dropped = true;
      const real = await route.fetch();
      expect(real.ok()).toBeTruthy();
      await route.abort('failed'); // Real server committed; only the browser response is lost.
    });
    await identity(page, id, '/apply/' + course.id + (held ? '?holdId=' + held.holdId : ''));
    if (action === 'apply') await page.getByRole('button', { name: 'Reserve my seat' }).click();
    if (action === 'confirm') await page.getByRole('button', { name: 'Complete mock payment', exact: true }).click();
    if (action === 'cancel') {
      await page.getByRole('button', { name: 'Cancel reservation', exact: true }).click();
      await page.getByRole('button', { name: 'Yes, cancel reservation', exact: true }).click();
    }
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    const expected = action === 'apply' ? 'Your seat is on hold' : action === 'confirm' ? 'Admission confirmed!' : 'Reservation cancelled';
    await expect(page.getByRole('heading', { name: expected, exact: true })).toBeVisible();
    const records: Hold[] = await (await service.get(API + '/me/holds', { headers: headers(id) })).json();
    expect(records.filter(h => h.classId === course.id)).toHaveLength(1);
    expect(records[0].status).toBe(action === 'apply' ? 'HELD' : action === 'confirm' ? 'CONFIRMED' : 'CANCELLED');
  });
}

test('actual six-second expiry updates application and history, releases seat, and allows reapply', async ({ page }, info) => {
  const course = await create('Actual deadline and reapply', 1);
  const id = student();
  const held = await reserve(course, id, true);
  await identity(page, id, '/apply/' + course.id + '?holdId=' + held.holdId);
  await expect(page.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your reservation has expired' })).toBeVisible({ timeout: 14000 });
  await expect(page.getByRole('button', { name: 'Complete mock payment', exact: true })).toHaveCount(0);
  expect((await summary(course)).availableSeats).toBe(1);
  const late = await service.post(API + '/holds/' + held.holdId + '/confirm', { headers: headers(id) });
  expect(late.status()).toBe(409);
  await expect(page.locator('.available-seats dd')).toHaveText('1');
  await page.screenshot({ path: info.outputPath('real-expired-application.png'), fullPage: true });
  const history = await page.context().newPage();
  await history.goto(UI + '/me');
  await history.getByRole('button', { name: /^Closed/ }).click();
  await expect(history.locator('.application-row .status-badge')).toHaveText('Expired');
  await history.close();
  await page.getByRole('button', { name: 'Check seats & apply again' }).click();
  await page.getByRole('button', { name: 'Reserve my seat' }).click();
  await expect(page.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('holdId')).not.toBe(held.holdId);
});

test('cross-tab identity change hides foreign hold and sends no mutation', async ({ page }) => {
  const course = await create('Identity switch isolation', 2);
  const owner = student(); const other = student();
  await holdScreen(page, course, owner);
  const foreignUrl = page.url();
  const holdId = new URL(foreignUrl).searchParams.get('holdId')!;
  let signalPending!: () => void;
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>(resolve => { signalPending = resolve; });
  const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });
  await page.route(API + '/holds/' + holdId, async route => {
    const real = await route.fetch();
    signalPending();
    await responseGate;
    try { await route.fulfill({ response: real }); } catch { /* identity change intentionally aborts this old request */ }
  });
  await pendingResponse;
  const second = await page.context().newPage();
  await second.goto(UI + '/me');
  await second.locator('#student-id').fill(other);
  await expect(page.locator('#student-id')).toHaveValue(other);
  releaseResponse();
  await expect(page.getByRole('alert')).toContainText('not available for the current student ID');
  await expect(page.getByRole('button', { name: 'Complete mock payment', exact: true })).toHaveCount(0);
  expect((await (await service.get(API + '/holds/' + holdId)).json()).status).toBe('HELD');
  const forbidden = await service.post(API + '/holds/' + holdId + '/confirm', { headers: headers(other) });
  expect(forbidden.status()).toBe(403);
  await second.close();
});

test('offline error is visible and retry recovers real application', async ({ page }) => {
  const course = await create('Network interruption recovery', 2);
  await holdScreen(page, course, student());
  await page.context().setOffline(true);
  await expect(page.getByRole('alert')).toContainText('Live updates paused');
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('real API concurrency, repeated confirmation and CORS preserve contract', async () => {
  const course = await create('Real API parallel capacity', 7);
  const ids = Array.from({ length: 60 }, student);
  const responses = await Promise.all(ids.map(id => service.post(API + '/classes/' + course.id + '/holds', { headers: headers(id) })));
  expect(responses.filter(r => r.status() === 201)).toHaveLength(7);
  expect(responses.filter(r => r.status() === 409)).toHaveLength(53);
  const hold: Hold = await responses.find(r => r.status() === 201)!.json();
  const confirmations = await Promise.all(Array.from({ length: 12 }, (_, i) => service.post((i % 2 ? SHORT : API) + '/holds/' + hold.holdId + '/confirm', { headers: headers(hold.studentId) })));
  expect(confirmations.every(r => r.status() === 200)).toBeTruthy();
  const count = await summary(course);
  expect([count.heldSeats, count.confirmedSeats, count.availableSeats]).toEqual([6, 1, 0]);
  const preflight = await service.fetch(API + '/me/holds', { method: 'OPTIONS', headers: { Origin: UI, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'X-Student-Id' } });
  expect(preflight.status()).toBe(204);
  expect(preflight.headers()['access-control-allow-origin']).toBe('*');
  expect(preflight.headers()['access-control-allow-headers'].toLowerCase()).toContain('x-student-id');
});

test('real-data screens fit 375px and 768px viewports', async ({ page }, info) => {
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await identity(page, STUDENT);
    await expect(page.locator('.class-card').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBeFalsy();
    await page.screenshot({ path: info.outputPath('real-directory-' + width + '.png'), fullPage: true });
    await page.goto(UI + '/me');
    await expect(page.locator('.application-row')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBeFalsy();
    await page.screenshot({ path: info.outputPath('real-applications-' + width + '.png'), fullPage: true });
  }
});
