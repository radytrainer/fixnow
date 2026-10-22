import { CalendarDays, Droplets, Snowflake, WashingMachine, Wrench, Zap, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { formatUsd, type BookingDto } from '@fixnow/shared';
import { useI18n } from '../i18n';
import { Card, IconTile, ProgressTrack, Row, StatusBadge, T } from './index';
import { colors, space, statusTone, toneColors } from './theme';

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  ac: Snowflake, bolt: Zap, drop: Droplets, washer: WashingMachine, tool: Wrench,
};

/** Bookings don't carry their category, so infer the icon from the service name (AC vs electrical). */
export function serviceIcon(nameEn: string): LucideIcon {
  // Match "AC" as a word or "air con…"; a bare "air" would also match "Repair".
  if (/\bAC\b|\bair[- ]?con/i.test(nameEn)) return Snowflake;
  if (/wir|outlet|switch|breaker|light|electr|fan|safety/i.test(nameEn)) return Zap;
  if (/pipe|leak|drain|toilet|pump|faucet|sink|plumb/i.test(nameEn)) return Droplets;
  return Wrench;
}

/**
 * The FixNow "service ticket": a status rail on the left edge, service icon, booking code,
 * the counterpart's name, a status pill and the 5-step progress track.
 */
export function BookingTicket({ b, perspective, onPress }: { b: BookingDto; perspective: 'customer' | 'technician'; onPress: () => void }) {
  const { pick, formatDate } = useI18n();
  const tone = statusTone(b.status);
  const who = perspective === 'technician' ? (b.customer?.name ?? '—') : b.technician.name;
  return (
    <Card testID={`booking-${b.bookingCode}`} onPress={onPress} padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: toneColors[tone].dot }} />
      <View style={{ padding: space(4), paddingLeft: space(5) }}>
        <Row gap={3} style={{ alignItems: 'flex-start' }}>
          <IconTile icon={serviceIcon(b.service.nameEn)} tone="info" size={42} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T weight="semibold" numberOfLines={1}>{pick(b.service.nameEn, b.service.nameKm)}</T>
            <T variant="small" color={colors.ink3} numberOfLines={1}>{b.bookingCode} · {who}</T>
            <View style={{ marginTop: space(2) }}><StatusBadge status={b.status} /></View>
          </View>
        </Row>
        <View style={{ marginTop: space(3.5) }}><ProgressTrack status={b.status} /></View>
        <Row style={{ justifyContent: 'space-between', marginTop: space(3) }}>
          <Row gap={1.5}>
            <CalendarDays size={14} color={colors.ink4} />
            <T variant="caption" color={colors.ink3}>{formatDate(b.scheduledAt)}</T>
          </Row>
          {b.payment ? <T variant="small" weight="bold">{formatUsd(b.payment.amount)}</T> : null}
        </Row>
      </View>
    </Card>
  );
}

/** Line-by-line list of everything booked in one visit, with each service's price range. */
export function BookedServices({ b }: { b: BookingDto }) {
  const { pick } = useI18n();
  if (b.services.length < 2) return null;
  return (
    <View testID="booked-services" style={{ marginTop: space(3), backgroundColor: colors.lineSoft, borderRadius: 12, padding: space(3), gap: space(2) }}>
      {b.services.map((s) => (
        <Row key={s.id} gap={2.5}>
          {(() => { const Icon = serviceIcon(s.nameEn); return <Icon size={16} color={colors.brand} />; })()}
          <T variant="small" weight="semibold" style={{ flex: 1 }}>{pick(s.nameEn, s.nameKm)}</T>
          {s.minPrice && <T variant="caption" color={colors.ink3}>${Number(s.minPrice)}–${Number(s.maxPrice)}</T>}
        </Row>
      ))}
    </View>
  );
}
