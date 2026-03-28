/** Format a number as UZS with space thousands separator: 3000000 → "3 000 000 UZS" */
export function formatUZS(n: number): string {
  return Math.round(n)
    .toLocaleString('ru-RU')
    .replace(/,/g, ' ') + ' UZS'
}

/** Compact format for dashboard stats: 3 500 000 → "3.5M UZS", 1 200 000 000 → "1.2B UZS" */
export function formatUZSCompact(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B UZS'
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1)     + 'M UZS'
  if (n >= 1_000)         return (n / 1_000).toFixed(0)         + 'K UZS'
  return formatUZS(n)
}

/** Mask a passport number for display: "AA1234567" → "AA***567" */
export function maskPassport(passport: string): string {
  if (!passport || passport.length < 4) return passport
  return passport.slice(0, 2) + '***' + passport.slice(-3)
}
