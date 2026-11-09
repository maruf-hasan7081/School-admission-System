import { test, expect, type Page, type Route } from '@playwright/test';

const STUDENT = '20102691234567890';
const OTHER_STUDENT = '20091234567890123';
const FIRST_CLASS = 'class-6-morning';
const API = 'http://127.0.0.1:8099';
type Status = 'HELD' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
type Course = { id: string; name: string; totalSeats: number; heldSeats: number; confirmedSeats: number; availableSeats: number };
type Hold = { holdId: string; classId: string; studentId: string; status: Status; expiresAt: string };

// These fixtures stay inside the isolated browser tests. No real API or database is used.
async function mockAdmissionService(page: Page) {
  const courses: Course[] = [
    { id: FIRST_CLASS, name: 'Class 6 - Morning Shift', totalSeats: 120, heldSeats: 12, confirmedSeats: 76, availableSeats: 32 },
    { id: 'class-7-day', name: 'Class 7 - Day Shift', totalSeats: 80, heldSeats: 0, confirmedSeats: 80, availableSeats: 0 },
    { id: 'class-8-morning', name: 'Class 8 - Morning Shift', totalSeats: 100, heldSeats: 4, confirmedSeats: 68, availableSeats: 28 },
    { id: 'class-9-science', name: 'Class 9 - Science', totalSeats: 60, heldSeats: 3, confirmedSeats: 42, availableSeats: 15 },
    { id: 'class-9-humanities', name: 'Class 9 - Humanities', totalSeats: 60, heldSeats: 1, confirmedSeats: 29, availableSeats: 30 },
    { id: 'class-10-day', name: 'Class 10 - Day Shift', totalSeats: 80, heldSeats: 2, confirmedSeats: 65, availableSeats: 13 },
  ];
  const holds: Hold[] = [];
  const state = {
    courses, holds,
    createHoldCalls: 0, confirmCalls: 0, cancelCalls: 0, createClassCalls: 0,
    myStudentRequests: [] as string[],
    failList: false,
    seedHold(classId = FIRST_CLASS, status: Status = 'HELD', studentId = STUDENT, expiresAt = new Date(Date.now() + 540000).toISOString()) {
      const hold: Hold = { holdId: `b31b7b8d-0000-4000-8000-${String(holds.length + 1).padStart(12, '0')}`, classId, studentId, status, expiresAt };
      holds.push(hold);
      return hold;
    },
  };
  const headers = {
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5179',
    'Access-Control-Allow-Headers': 'Content-Type,X-Student-Id',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  };
  async function reply(route: Route, body: unknown, status = 200) {
    await route.fulfill({ status, headers, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
  }
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const studentId = request.headers()['x-student-id'] ?? '';
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/classes' && method === 'GET') {
      return state.failList ? reply(route, { message: 'Admission service temporarily unavailable. Please retry.' }, 503) : reply(route, courses);
    }
    if (path === '/classes' && method === 'POST') {
      state.createClassCalls += 1;
      const body = request.postDataJSON() as { name: string; totalSeats: number };
      if (!body.name?.trim() || !Number.isInteger(body.totalSeats) || body.totalSeats < 1) return reply(route, { message: 'Enter a class name and a positive whole number of seats.' }, 400);
      const created = { id: `created-class-${state.createClassCalls}`, name: body.name.trim(), totalSeats: body.totalSeats, heldSeats: 0, confirmedSeats: 0, availableSeats: body.totalSeats };
      courses.push(created);
      return reply(route, created, 201);
    }
    if (path === '/me/holds' && method === 'GET') {
      state.myStudentRequests.push(studentId);
      return reply(route, holds.filter((hold) => hold.studentId === studentId).map((hold) => ({ ...hold, className: courses.find((item) => item.id === hold.classId)?.name ?? 'Unknown class' })));
    }
    const coursePath = path.match(/^\/classes\/([^/]+)$/);
    if (coursePath && method === 'GET') {
      const course = courses.find((item) => item.id === coursePath[1]);
      return course ? reply(route, course) : reply(route, { message: 'Class not found.' }, 404);
    }
    const createPath = path.match(/^\/classes\/([^/]+)\/holds$/);
    if (createPath && method === 'POST') {
      state.createHoldCalls += 1;
      const course = courses.find((item) => item.id === createPath[1]);
      if (!course) return reply(route, { message: 'Class not found.' }, 404);
      if (!/^\d{17}$/.test(studentId)) return reply(route, { message: 'A valid student ID is required.' }, 400);
      const existing = holds.find((item) => item.classId === course.id && item.studentId === studentId && (item.status === 'HELD' || item.status === 'CONFIRMED'));
      if (existing) return reply(route, existing, 201);
      if (course.availableSeats <= 0) return reply(route, { message: 'No seats are available.' }, 409);
      const hold = state.seedHold(course.id, 'HELD', studentId);
      course.heldSeats += 1;
      course.availableSeats -= 1;
      return reply(route, hold, 201);
    }
    const holdPath = path.match(/^\/holds\/([^/]+)(\/confirm)?$/);
    if (holdPath) {
      const hold = holds.find((item) => item.holdId === holdPath[1]);
      if (!hold) return reply(route, { message: 'Application not found.' }, 404);
      if (method === 'GET') return reply(route, { holdId: hold.holdId, classId: hold.classId, status: hold.status, expiresAt: hold.expiresAt });
      if (hold.studentId !== studentId) return reply(route, { message: 'This application belongs to another student.' }, 403);
      const course = courses.find((item) => item.id === hold.classId)!;
      if (method === 'POST' && holdPath[2]) {
        state.confirmCalls += 1;
        if (hold.status === 'HELD') { hold.status = 'CONFIRMED'; course.heldSeats -= 1; course.confirmedSeats += 1; }
        return reply(route, { holdId: hold.holdId, status: hold.status });
      }
      if (method === 'DELETE') {
        state.cancelCalls += 1;
        if (hold.status === 'HELD') { hold.status = 'CANCELLED'; course.heldSeats -= 1; course.availableSeats += 1; }
        return reply(route, undefined, 204);
      }
    }
    return reply(route, { message: `Unexpected mock route: ${method} ${path}` }, 404);
  });
  return state;
}

async function useIdentity(page: Page, studentId = STUDENT) {
  await page.addInitScript((id) => localStorage.setItem('school-admission-student-id', id), studentId);
}
async function reserveSeat(page: Page) {
  await page.goto(`/apply/${FIRST_CLASS}`);
  await page.getByRole('button', { name: 'Reserve my seat' }).click();
  await expect(page).toHaveURL(/holdId=/);
  await expect(page.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
}

test('class directory shows real counts, search, availability filter and a disabled full class', async ({ page }, testInfo) => {
  await mockAdmissionService(page);
  await page.goto('/');
  await expect(page.locator('.class-card')).toHaveCount(6);
  const fullClass = page.locator('.class-card').filter({ hasText: 'Class 7 - Day Shift' });
  await expect(fullClass.getByRole('button', { name: 'All seats are reserved' })).toBeDisabled();
  await expect(fullClass.locator('.seat-count strong')).toHaveText('0');
  await expect(page.locator('.summary-card').first()).toContainText('118');
  await page.getByRole('searchbox', { name: 'Search classes or shifts' }).fill('Science');
  await expect(page.locator('.class-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Class 9 - Science' })).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await page.getByRole('button', { name: 'Available', exact: true }).click();
  await expect(page.locator('.class-card')).toHaveCount(5);
  await expect(fullClass).toHaveCount(0);
  await page.getByRole('button', { name: 'All classes', exact: true }).click();
  await expect(page.locator('.class-card')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('desktop-directory.png'), fullPage: true });
});

test('invalid student ID blocks applications and directs focus to the identity field', async ({ page }) => {
  const state = await mockAdmissionService(page);
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: 'Your applications are one ID away' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter Student ID' }).click();
  await expect(page.locator('#student-id')).toBeFocused();
  await page.locator('#student-id').fill('12345');
  await expect(page.locator('#student-id')).toHaveAttribute('aria-invalid', 'true');
  await page.goto(`/apply/${FIRST_CLASS}`);
  await expect(page.getByRole('button', { name: 'Reserve my seat' })).toBeDisabled();
  await expect(page.getByText('Start with your student ID', { exact: true })).toBeVisible();
  expect(state.myStudentRequests).toHaveLength(0);
  expect(state.createHoldCalls).toBe(0);
});

test('reservation survives reload and rapid duplicate confirmation sends one payment request', async ({ page }, testInfo) => {
  const state = await mockAdmissionService(page);
  await useIdentity(page);
  await reserveSeat(page);
  const savedUrl = page.url();
  await page.screenshot({ path: testInfo.outputPath('held-application.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  expect(page.url()).toBe(savedUrl);
  expect(state.createHoldCalls).toBe(1);
  await expect(page.locator('#student-id')).toHaveValue(STUDENT);
  await page.getByRole('button', { name: 'Complete mock payment', exact: true }).evaluate((node: HTMLButtonElement) => { node.click(); node.click(); });
  await expect(page.getByRole('heading', { name: 'Admission confirmed!' })).toBeVisible();
  expect(state.confirmCalls).toBe(1);
  await expect(page.getByRole('button', { name: 'Complete mock payment', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('confirmed-application.png'), fullPage: true });
  await page.getByRole('link', { name: 'View my applications', exact: true }).click();
  await expect(page.locator('.application-row')).toHaveCount(1);
  await expect(page.locator('.application-row .status-badge')).toHaveText('Confirmed');
  await page.screenshot({ path: testInfo.outputPath('my-applications.png'), fullPage: true });
});

test('cancel dialog allows keeping a seat, then cancellation releases it and permits a new application', async ({ page }) => {
  const state = await mockAdmissionService(page);
  await useIdentity(page);
  await reserveSeat(page);
  const firstHoldUrl = page.url();
  await page.getByRole('button', { name: 'Cancel reservation', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Release your reserved seat?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep my seat' }).click();
  await expect(page.getByRole('group', { name: 'Release your reserved seat?' })).toHaveCount(0);
  expect(state.cancelCalls).toBe(0);
  await page.getByRole('button', { name: 'Cancel reservation', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, cancel reservation' }).click();
  await expect(page.getByRole('heading', { name: 'Reservation cancelled' })).toBeVisible();
  expect(state.cancelCalls).toBe(1);
  await page.getByRole('button', { name: 'Check seats & apply again' }).click();
  await page.getByRole('button', { name: 'Reserve my seat' }).click();
  await expect(page.getByRole('heading', { name: 'Your seat is on hold' })).toBeVisible();
  expect(page.url()).not.toBe(firstHoldUrl);
  expect(state.createHoldCalls).toBe(2);
});

test('local deadline removes payment actions even when the server still reports HELD', async ({ page }) => {
  const state = await mockAdmissionService(page);
  const initialTime = new Date('2026-11-09T15:00:00Z').getTime();
  const hold = state.seedHold(FIRST_CLASS, 'HELD', STUDENT, new Date(initialTime + 2000).toISOString());
  await page.clock.setFixedTime(initialTime);
  await useIdentity(page);
  await page.goto(`/apply/${FIRST_CLASS}?holdId=${hold.holdId}`);
  await expect(page.getByRole('button', { name: 'Complete mock payment', exact: true })).toBeEnabled();
  await page.clock.setFixedTime(initialTime + 5000);
  await expect(page.getByRole('heading', { name: 'Your reservation has expired' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete mock payment', exact: true })).toHaveCount(0);
  expect(state.holds[0].status).toBe('HELD');
  expect(state.confirmCalls).toBe(0);
});

test('changing identity hides another student reservation and cannot confirm it', async ({ page }) => {
  const state = await mockAdmissionService(page);
  const hold = state.seedHold();
  state.seedHold('class-9-science', 'CONFIRMED', OTHER_STUDENT);
  await useIdentity(page);
  await page.goto(`/apply/${FIRST_CLASS}?holdId=${hold.holdId}`);
  await expect(page.getByRole('button', { name: 'Complete mock payment', exact: true })).toBeEnabled();
  await page.locator('#student-id').fill(OTHER_STUDENT);
  await expect(page.getByText('This application is not available for the current student ID.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete mock payment', exact: true })).toHaveCount(0);
  expect(state.confirmCalls).toBe(0);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My applications' }).click();
  await expect(page.locator('.application-row')).toHaveCount(1);
  await expect(page.locator('.application-row')).toContainText('Class 9 - Science');
  await expect(page.locator('.application-row')).not.toContainText('Class 6 - Morning Shift');
});

test('application filters use current status and refresh picks up server changes', async ({ page }) => {
  const state = await mockAdmissionService(page);
  const active = state.seedHold();
  state.seedHold('class-9-science', 'CONFIRMED');
  state.seedHold('class-8-morning', 'CANCELLED');
  await useIdentity(page);
  await page.goto('/me');
  await expect(page.locator('.application-row')).toHaveCount(3);
  await page.getByRole('button', { name: /^Active/ }).click();
  await expect(page.locator('.application-row')).toHaveCount(1);
  await expect(page.locator('.application-row')).toContainText('Class 6 - Morning Shift');
  active.status = 'EXPIRED';
  await page.getByRole('button', { name: 'Refresh applications' }).click();
  await expect(page.getByRole('heading', { name: 'No active applications' })).toBeVisible();
  await page.getByRole('button', { name: /^Confirmed/ }).click();
  await expect(page.locator('.application-row')).toHaveCount(1);
  await expect(page.locator('.application-row')).toContainText('Class 9 - Science');
  await page.getByRole('button', { name: /^Closed/ }).click();
  await expect(page.locator('.application-row')).toHaveCount(2);
});

test('backend failure can retry and a missing class has a safe recovery screen', async ({ page }) => {
  const state = await mockAdmissionService(page);
  state.failList = true;
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Admission service temporarily unavailable');
  state.failList = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.class-card')).toHaveCount(6);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.goto('/apply/missing-class');
  await expect(page.getByRole('alert')).toContainText('Class not found');
  await expect(page.getByRole('heading', { name: 'Application unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reserve my seat' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Browse classes', exact: true }).click();
  await expect(page.locator('.class-card')).toHaveCount(6);
});

test('create class validates locally and returns a new available class to the directory', async ({ page }, testInfo) => {
  const state = await mockAdmissionService(page);
  await page.goto('/admin/create');
  const name = page.getByLabel(/^(Class name|Name)$/i);
  const seats = page.getByLabel(/^(Total seats|Seat capacity)$/i);
  const submit = page.getByRole('button', { name: /^Create class$|^Create$/i });
  await name.fill('   ');
  await seats.fill('45');
  await submit.click();
  await expect(page.getByText('Enter a class name.', { exact: true })).toBeVisible();
  expect(state.createClassCalls).toBe(0);
  await expect(name).toBeFocused();
  await name.fill('Class 11 - Science Morning');
  for (const invalidSeats of ['0', '1.5', '2147483648']) {
    await seats.fill(invalidSeats);
    await submit.click();
    await expect(page.getByText('Enter a whole number of seats between 1 and 2,147,483,647.', { exact: true })).toBeVisible();
    expect(state.createClassCalls).toBe(0);
    await expect(seats).toBeFocused();
  }
  await expect(page).toHaveURL(/\/admin\/create$/);
  await seats.fill('45');
  await page.screenshot({ path: testInfo.outputPath('create-class.png'), fullPage: true });
  await submit.click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Class 11 - Science Morning', exact: true })).toBeVisible();
  expect(state.createClassCalls).toBe(1);
  await expect(page.locator('.class-card').filter({ hasText: 'Class 11 - Science Morning' }).locator('.seat-count strong')).toHaveText('45');
});

test('375px mobile directory and application fit the viewport without horizontal scrolling', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mockAdmissionService(page);
  await useIdentity(page);
  await page.goto('/');
  await expect(page.locator('.class-card')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-directory.png'), fullPage: true });
  await reserveSeat(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Complete mock payment', exact: true })).toBeVisible();
});