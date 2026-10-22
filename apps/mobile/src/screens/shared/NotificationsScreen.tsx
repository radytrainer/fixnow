import {
  Ban, Banknote, BellOff, BellRing, CircleCheck, CreditCard, DoorClosed, Hammer, MessageSquare, PartyPopper, RotateCcw, Scale,
  ShieldCheck, Star, Timer, Undo2, X, type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useI18n } from '../../i18n';
import { useNav } from '../../lib/nav';
import { useNotifications } from '../../lib/notifications';
import { Button, Empty, IconTile, Screen, T } from '../../ui';
import { colors, radius, shadow, space, type Tone } from '../../ui/theme';

const ICON: Record<string, [LucideIcon, Tone]> = {
  BOOKING_REQUESTED: [BellRing, 'accent'], BOOKING_ACCEPTED: [CircleCheck, 'success'], BOOKING_DECLINED: [Undo2, 'neutral'],
  BOOKING_EXPIRED: [Timer, 'warning'], BOOKING_EXPIRED_TECH: [Timer, 'warning'], BOOKING_STARTED: [Hammer, 'info'],
  BOOKING_FINISHED: [CreditCard, 'accent'], BOOKING_CANCELLED: [X, 'neutral'], CUSTOMER_NOT_AVAILABLE: [DoorClosed, 'neutral'],
  PAYMENT_CONFIRMED: [Banknote, 'success'], PAYMENT_CONFIRMED_TECH: [Banknote, 'success'], PAYMENT_REFUNDED: [Undo2, 'danger'],
  PAYOUT_PAID: [Banknote, 'success'], RATING_RECEIVED: [Star, 'warning'], WARRANTY_REQUESTED: [ShieldCheck, 'info'],
  WARRANTY_UPDATED: [ShieldCheck, 'info'], TECHNICIAN_APPROVED: [PartyPopper, 'success'], TECHNICIAN_REJECTED: [X, 'danger'],
  TECHNICIAN_SUSPENDED: [Ban, 'danger'], TECHNICIAN_REINSTATED: [RotateCcw, 'success'], TICKET_UPDATED: [MessageSquare, 'info'],
  BOOKING_DISPUTED: [Scale, 'danger'],
};
const iconFor = (type: string): [LucideIcon, Tone] => ICON[type] ?? [BellRing, 'info'];

export function NotificationsScreen() {
  const { t, formatDate } = useI18n();
  const n = useNotifications();
  if (!n) return null;
  return (
    <Screen title={t('notif.title')} right={n.unread > 0 ? <Button small full={false} variant="ghost" label={t('notif.markAll')} onPress={() => n.markRead()} /> : undefined}>
      {n.items.length === 0 && <Empty text={t('notif.empty')} icon={BellOff} />}
      {n.items.map((item) => {
        const [Icon, tone] = iconFor(item.type);
        return (
          <Pressable
            key={item.id} testID={`notif-${item.type}`} accessibilityRole="button" onPress={() => n.open(item)}
            style={({ pressed }) => [{
              flexDirection: 'row', gap: space(3), padding: space(4), marginBottom: space(2), borderRadius: radius.lg, borderWidth: 1,
              borderColor: item.read ? colors.line : colors.brandLine, backgroundColor: item.read ? colors.surface : colors.brandSoft,
            }, pressed && { opacity: 0.85 }]}
          >
            <IconTile icon={Icon} tone={tone} size={40} />
            <View style={{ flex: 1 }}>
              <T variant="small" weight={item.read ? 'regular' : 'semibold'}>{n.format(item)}</T>
              <T variant="caption" color={colors.ink4} style={{ marginTop: space(1) }}>{formatDate(item.createdAt)}</T>
            </View>
            {!item.read && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand, marginTop: 6 }} />}
          </Pressable>
        );
      })}
    </Screen>
  );
}

/** Slide-down toast for a newly arrived notification. */
export function NotificationToast() {
  const n = useNotifications();
  const nav = useNav();
  // The inbox already shows new items live, so a toast there would only cover the list.
  if (!n?.toast || nav.current.name === 'Notifications') return null;
  const item = n.toast;
  const [Icon, tone] = iconFor(item.type);
  return (
    <Pressable
      testID="notif-toast" accessibilityRole="alert" onPress={() => n.open(item)}
      style={{
        position: 'absolute', top: space(12), left: space(3), right: space(3), zIndex: 50, flexDirection: 'row', gap: space(3),
        alignItems: 'center', padding: space(3.5), borderRadius: radius.lg, backgroundColor: colors.deep, ...shadow.float,
      }}
    >
      <IconTile icon={Icon} tone={tone} size={38} />
      <T variant="small" weight="semibold" color={colors.white} style={{ flex: 1 }}>{n.format(item)}</T>
      <Pressable accessibilityLabel="Dismiss" hitSlop={12} onPress={n.dismissToast}><X size={18} color="#94A3B8" /></Pressable>
    </Pressable>
  );
}
