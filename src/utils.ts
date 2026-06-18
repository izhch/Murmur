export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr.replace(/-/g, '/'));
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
  if (diff < 30 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  if (year === now.getFullYear()) return `${month}-${day}`;
  return `${year}-${month}-${day}`;
}

export function generateFixedRandom(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const positiveHash = Math.abs(hash);
  const range = max - min + 1;
  return min + (positiveHash % range);
}

export function normalizeDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}

export function formatDate(date: Date | string): string {
  const d = normalizeDate(date);
  return d.toISOString().split('T')[0];
}
