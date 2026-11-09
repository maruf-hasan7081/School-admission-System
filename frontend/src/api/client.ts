const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5080').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.name = 'ApiError'; this.status = status; }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'We could not connect to the admission service. Check your connection and try again.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json() as { message?: string; title?: string };
    return body.message ?? body.title ?? `The request could not be completed (${res.status}).`;
  } catch { return `The request could not be completed (${res.status}). Please try again.`; }
}
export async function apiFetch<T>(path: string, options: RequestInit & { studentId?: string } = {}): Promise<T> {
  const { studentId, signal, ...request } = options;
  const headers = new Headers(request.headers);
  if (request.body) headers.set('Content-Type', 'application/json');
  if (studentId) headers.set('X-Student-Id', studentId);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15000);
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...request, headers, signal: controller.signal });
    if (!response.ok) throw new ApiError(await parseError(response), response.status);
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (error) {
    if (timedOut && !signal?.aborted) throw new ApiError('The admission service is taking too long to respond. Please try again.', 0);
    if (error instanceof SyntaxError) throw new ApiError('The admission service returned an unexpected response. Please try again.', 0);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
const id = encodeURIComponent;
export const api = {
  listClasses: (signal?: AbortSignal) => apiFetch<ClassSummary[]>('/classes', { signal }),
  getClass: (classId: string, signal?: AbortSignal) => apiFetch<ClassSummary>(`/classes/${id(classId)}`, { signal }),
  createClass: (body: CreateClassRequest) => apiFetch<ClassCreated>('/classes', { method: 'POST', body: JSON.stringify(body) }),
  createHold: (classId: string, studentId: string) => apiFetch<HoldCreated>(`/classes/${id(classId)}/holds`, { method: 'POST', studentId }),
  getHold: (holdId: string, signal?: AbortSignal) => apiFetch<HoldDetail>(`/holds/${id(holdId)}`, { signal }),
  confirmHold: (holdId: string, studentId: string) => apiFetch<HoldConfirmed>(`/holds/${id(holdId)}/confirm`, { method: 'POST', studentId }),
  cancelHold: (holdId: string, studentId: string) => apiFetch<void>(`/holds/${id(holdId)}`, { method: 'DELETE', studentId }),
  myHolds: (studentId: string, signal?: AbortSignal) => apiFetch<MyHold[]>('/me/holds', { studentId, signal }),
};
export type ClassSummary = { id: string; name: string; totalSeats: number; heldSeats: number; confirmedSeats: number; availableSeats: number };
export type CreateClassRequest = { name: string; totalSeats: number };
export type ClassCreated = { id: string; name: string; totalSeats: number };
export type HoldCreated = { holdId: string; classId: string; studentId: string; status: 'HELD'; expiresAt: string };
export type HoldDetail = { holdId: string; classId: string; status: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED'; expiresAt: string };
export type HoldConfirmed = { holdId: string; status: 'CONFIRMED' };
export type MyHold = { holdId: string; classId: string; className: string; status: HoldDetail['status']; expiresAt: string };
