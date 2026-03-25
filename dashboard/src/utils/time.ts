export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function toDate(input?: string | number | Date | null): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

  if (typeof input === 'string') {
    const raw = input.trim();
    // Backend often returns ISO datetime without timezone (e.g. 2026-03-08T14:22:30.123456).
    // Treat such values as UTC, then render in local PC/browser timezone.
    const isoNoTz =
      /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw);
    const normalized = isoNoTz ? `${raw.replace(' ', 'T')}Z` : raw;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatLocalTime(input?: string | number | Date | null): string {
  const date = toDate(input) ?? new Date();
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: getLocalTimeZone(),
  });
}

export function formatLocalDate(input?: string | number | Date | null): string {
  const date = toDate(input) ?? new Date();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: getLocalTimeZone(),
  });
}

export function formatLocalDateTime(input?: string | number | Date | null): string {
  const date = toDate(input);
  if (!date) return '—';
  return date.toLocaleString('en-US', { timeZone: getLocalTimeZone() });
}
