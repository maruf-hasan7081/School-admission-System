const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; title?: string };
    return body.message ?? body.title ?? res.statusText;
  } catch {
    return res.statusText || `Request failed (${res.status})`;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { studentId?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.studentId) {
    headers.set('X-Student-Id', options.studentId);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  listClasses: () => apiFetch<ClassSummary[]>('/classes'),
  getClass: (classId: string) => apiFetch<ClassSummary>(`/classes/${classId}`),
  createClass: (body: CreateClassRequest) =>
    apiFetch<ClassCreated>('/classes', { method: 'POST', body: JSON.stringify(body) }),
  createHold: (classId: string, studentId: string) =>
    apiFetch<HoldCreated>(`/classes/${classId}/holds`, {
      method: 'POST',
      studentId,
    }),
  getHold: (holdId: string) => apiFetch<HoldDetail>(`/holds/${holdId}`),
  confirmHold: (holdId: string, studentId: string) =>
    apiFetch<HoldConfirmed>(`/holds/${holdId}/confirm`, {
      method: 'POST',
      studentId,
    }),
  cancelHold: (holdId: string, studentId: string) =>
    apiFetch<void>(`/holds/${holdId}`, { method: 'DELETE', studentId }),
  myHolds: (studentId: string) => apiFetch<MyHold[]>(`/me/holds`, { studentId }),
};

export type ClassSummary = {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
};

export type CreateClassRequest = {
  name: string;
  totalSeats: number;
};

export type ClassCreated = {
  id: string;
  name: string;
  totalSeats: number;
};

export type HoldCreated = {
  holdId: string;
  classId: string;
  studentId: string;
  status: 'HELD';
  expiresAt: string;
};

export type HoldDetail = {
  holdId: string;
  classId: string;
  status: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
};

export type HoldConfirmed = {
  holdId: string;
  status: 'CONFIRMED';
};

export type MyHold = {
  holdId: string;
  classId: string;
  className: string;
  status: HoldDetail['status'];
  expiresAt: string;
};
