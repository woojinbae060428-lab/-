const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function formatKoreanDate(dateInput: string | null | undefined): string {
  if (!dateInput) return '-';
  const datePart = String(dateInput).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return datePart;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  const weekday = WEEKDAY_NAMES[dt.getUTCDay()] ?? '';
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} (${weekday})`;
}

export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '-';
  const startStr = String(start).slice(0, 10);
  const endStr = end ? String(end).slice(0, 10) : '';
  if (!endStr || endStr === startStr) {
    return formatKoreanDate(startStr);
  }
  return `${formatKoreanDate(startStr)} — ${formatKoreanDate(endStr)}`;
}

export function formatCount(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('ko-KR');
}

export function formatRatio(value: number | string | null | undefined): string {
  if (typeof value === 'string' && value.trim().endsWith('%')) {
    return value.trim();
  }
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0%';
  const pct = num > 0 && num <= 1 ? num * 100 : num;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function isSafePosterUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
