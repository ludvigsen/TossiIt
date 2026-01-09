export function getDayRangeFromTzOffsetMinutes(
  nowUtc: Date,
  tzOffsetMinutes: number | null | undefined,
): { startUtc: Date; endUtc: Date; localDateISO: string } {
  // tzOffsetMinutes matches JS Date.getTimezoneOffset():
  // minutes to add to local time to get UTC (e.g. CET winter = -60? actually getTimezoneOffset() is +60 in CET winter)
  // We'll treat it as "local -> UTC = local + offset", so "UTC -> local = UTC - offset".
  const offset = typeof tzOffsetMinutes === 'number' && Number.isFinite(tzOffsetMinutes) ? tzOffsetMinutes : 0;

  const localNow = new Date(nowUtc.getTime() - offset * 60 * 1000);
  const localStart = new Date(localNow);
  localStart.setHours(0, 0, 0, 0);
  const localEnd = new Date(localNow);
  localEnd.setHours(23, 59, 59, 999);

  const startUtc = new Date(localStart.getTime() + offset * 60 * 1000);
  const endUtc = new Date(localEnd.getTime() + offset * 60 * 1000);

  const yyyy = localStart.getFullYear();
  const mm = String(localStart.getMonth() + 1).padStart(2, '0');
  const dd = String(localStart.getDate()).padStart(2, '0');
  const localDateISO = `${yyyy}-${mm}-${dd}`;

  return { startUtc, endUtc, localDateISO };
}


