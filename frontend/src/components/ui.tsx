import type { ReactNode } from 'react';
import type { HoldDetail } from '../api/client';

const paths: Record<string, string> = {
  school: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M9 10h.01M15 10h.01M12 4V2',
  book: 'M12 7c-3-3-7-3-10-2v14c3-1 7-1 10 2 3-3 7-3 10-2V5c-3-1-7-1-10 2Zm0 0v14',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  files: 'M8 3h9l4 4v14H8zM17 3v5h4M4 17H3V3h1M12 12h5M12 16h5',
  plus: 'M12 5v14M5 12h14',
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  'arrow-left': 'M19 12H5m6-6-6 6 6 6',
  clock: 'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M18 6 6 18',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1',
  alert: 'M12 9v4m0 3h.01M10.3 4 2 19h20L13.7 4a2 2 0 0 0-3.4 0',
  shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7zM8 12l3 3 5-6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  'credit-card': 'M2 7h20M2 11h20M6 16h3M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  info: 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 11h18M8 15h2M14 15h2',
  'chevron-right': 'm9 5 7 7-7 7',
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const aliases: Record<string, string> = { 'book-open': 'book', 'file-text': 'files', 'shield-check': 'shield', x: 'close', application: 'files', applications: 'files', building: 'school', graduation: 'school', 'graduation-cap': 'school', 'check-circle': 'check', 'alert-circle': 'alert', 'x-circle': 'close', 'arrow-up-right': 'arrow-right', 'user': 'users', 'clipboard': 'files', 'refresh-cw': 'refresh', 'creditCard': 'credit-card', seats: 'users' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[aliases[name] ?? name] ?? paths.book} /></svg>;
}
export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}
const labels = { HELD: 'Seat held', CONFIRMED: 'Confirmed', EXPIRED: 'Expired', CANCELLED: 'Cancelled' };
export function StatusBadge({ status }: { status: HoldDetail['status'] }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}><span className="status-dot" />{labels[status]}</span>;
}
export function EmptyState({ icon, title, description, children }: { icon: string; title: string; description: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={30} /></span><h2>{title}</h2><p>{description}</p>{children && <div className="empty-actions">{children}</div>}</div>;
}
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-notice" role="alert"><Icon name="alert" /><div><strong>Something needs your attention</strong><p>{message}</p></div>{onRetry && <button className="button button-secondary button-small" onClick={onRetry} type="button"><Icon name="refresh" size={16} />Try again</button>}</div>;
}
export function LoadingState({ label = 'Loading your admission details...' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="spinner" /><span>{label}</span></div>;
}
