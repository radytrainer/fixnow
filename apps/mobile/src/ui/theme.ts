import type { BookingStatus } from '@fixnow/shared';

/**
 * FixNow mobile design tokens.
 * Identity: deep "service blue" surfaces for hero moments, one brand blue for actions,
 * the orange "wrench" accent reserved for time-sensitive items (countdowns, DEMO, amounts due).
 */
export const colors = {
  brand: '#2563EB',
  brandPressed: '#1D4ED8',
  brandSoft: '#EEF3FF',
  brandLine: '#C9D8FD',
  deep: '#0B1B4D',        // hero background
  deep2: '#14296E',       // hero gradient partner / pressed
  accent: '#F97316',      // wrench orange
  accentSoft: '#FFF2E8',
  violet: '#7C3AED',
  violetSoft: '#F3EEFF',

  ink: '#0F172A',
  ink2: '#334155',
  ink3: '#64748B',
  ink4: '#94A3B8',
  line: '#E6E9EF',
  lineSoft: '#F1F3F7',
  canvas: '#F5F7FB',
  surface: '#FFFFFF',

  success: '#15803D',
  successSoft: '#EAF7EF',
  warning: '#B45309',
  warningSoft: '#FEF4E6',
  danger: '#DC2626',
  dangerSoft: '#FDEEEE',
  white: '#FFFFFF',

  // legacy aliases used by older screens
  primary: '#2563EB', primaryDark: '#1D4ED8', primarySoft: '#EEF3FF', secondary: '#7C3AED', secondarySoft: '#F3EEFF',
  navy: '#0F172A', text: '#0F172A', textMuted: '#475569', textSubtle: '#64748B', border: '#E6E9EF', bg: '#F5F7FB', card: '#FFFFFF',
};

export const radius = { xs: 6, sm: 10, md: 12, lg: 16, xl: 20, pill: 999 };
export const space = (n: number) => n * 4;

export const fonts = {
  en: { regular: 'PlusJakartaSans_400Regular', medium: 'PlusJakartaSans_500Medium', semibold: 'PlusJakartaSans_600SemiBold', bold: 'PlusJakartaSans_700Bold' },
  km: { regular: 'NotoSansKhmer_400Regular', medium: 'NotoSansKhmer_500Medium', semibold: 'NotoSansKhmer_600SemiBold', bold: 'NotoSansKhmer_700Bold' },
};

/** Type scale (size / weight). Khmer automatically gets a taller line height in <T>. */
export const type = {
  display: { size: 26, weight: 'bold' },
  title: { size: 20, weight: 'bold' },
  h3: { size: 16, weight: 'semibold' },
  body: { size: 15, weight: 'regular' },
  label: { size: 14, weight: 'medium' },
  small: { size: 13, weight: 'regular' },
  caption: { size: 12, weight: 'medium' },
} as const;

export const shadow = {
  card: { shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  float: { shadowColor: '#0B1B4D', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
};

export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'accent';

export const toneColors: Record<Tone, { bg: string; fg: string; dot: string }> = {
  info: { bg: colors.brandSoft, fg: colors.brandPressed, dot: colors.brand },
  success: { bg: colors.successSoft, fg: colors.success, dot: '#22C55E' },
  warning: { bg: colors.warningSoft, fg: colors.warning, dot: '#F59E0B' },
  danger: { bg: colors.dangerSoft, fg: colors.danger, dot: colors.danger },
  neutral: { bg: '#EEF1F5', fg: colors.ink3, dot: colors.ink4 },
  accent: { bg: colors.accentSoft, fg: '#C2410C', dot: colors.accent },
};

export function statusTone(status: BookingStatus | string): Tone {
  switch (status) {
    case 'REQUESTED': case 'PENDING': case 'OPEN': return 'warning';
    case 'ACCEPTED': case 'CONFIRMED': case 'PROCESSING': case 'IN_REVIEW': return 'info';
    case 'FINISHED': return 'accent';
    case 'PAID': case 'RATED': case 'CLOSED': case 'APPROVED': case 'RESOLVED': return 'success';
    case 'DECLINED': case 'EXPIRED': case 'CANCELLED': case 'CUSTOMER_NOT_AVAILABLE': return 'neutral';
    case 'DISPUTED': case 'REFUNDED': case 'REJECTED': case 'SUSPENDED': case 'FAILED': return 'danger';
    default: return 'neutral';
  }
}

/** The five customer-visible steps of a job, used by the progress track. */
export const JOB_STEPS: BookingStatus[] = ['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'FINISHED', 'PAID'];
export function jobStepIndex(status: BookingStatus | string) {
  if (status === 'RATED' || status === 'CLOSED') return 4;
  const i = JOB_STEPS.indexOf(status as BookingStatus);
  return i;
}
