/**
 * Money helpers. All arithmetic happens on integer cents so that floating-point
 * error never reaches a stored amount. Amounts travel as decimal strings ("25.00").
 */

export function toCents(amount: string | number): number {
  const s = typeof amount === 'number' ? amount.toFixed(2) : amount.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid money amount: ${amount}`);
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Splits a gross amount into commission and technician net. Rate is a percentage, e.g. "15" or "12.5". */
export function splitCommission(amount: string | number, ratePercent: string | number) {
  const grossCents = toCents(amount);
  const rateBasisPoints = toCents(ratePercent); // "15.00" -> 1500 bp
  if (rateBasisPoints < 0 || rateBasisPoints > 10000) throw new Error('Commission rate must be between 0 and 100');
  // Round half up on the commission; the technician receives the exact remainder.
  const commissionCents = Math.floor((grossCents * rateBasisPoints + 5000) / 10000);
  return {
    amount: fromCents(grossCents),
    commissionRate: fromCents(rateBasisPoints),
    commissionAmount: fromCents(commissionCents),
    technicianNet: fromCents(grossCents - commissionCents),
  };
}

export function formatUsd(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  return `$${fromCents(toCents(typeof amount === 'number' ? amount.toFixed(2) : amount))}`;
}
