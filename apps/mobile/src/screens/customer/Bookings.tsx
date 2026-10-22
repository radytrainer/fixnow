import { ClipboardList } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import type { BookingDto, Paginated } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { useNav } from '../../lib/nav';
import { useApi } from '../../lib/useApi';
import { Button, Empty, ErrorState, Loading, Screen, Segmented } from '../../ui';
import { BookingTicket } from '../../ui/booking';
import { space } from '../../ui/theme';

/** Kept for screens that list bookings; renders the shared service ticket. */
export function BookingRow({ b, onPress, showCustomer }: { b: BookingDto; onPress: () => void; showCustomer?: boolean }) {
  return <BookingTicket b={b} perspective={showCustomer ? 'technician' : 'customer'} onPress={onPress} />;
}

export function CustomerBookings() {
  const { t } = useI18n();
  const nav = useNav();
  const [scope, setScope] = useState<'active' | 'history'>('active');
  const q = useApi<Paginated<BookingDto>>(`/bookings?scope=${scope}&pageSize=50`, { pollMs: 8000 });
  return (
    <Screen title={t('bookings.title')} back={false}>
      <View style={{ marginBottom: space(4) }}>
        <Segmented value={scope} onChange={setScope} options={[['active', t('bookings.active')], ['history', t('bookings.history')]]} />
      </View>
      {q.loading && !q.data && <Loading />}
      {q.error && !q.data && <ErrorState error={q.error} onRetry={() => q.reload()} />}
      {q.data?.items.length === 0 && (
        <Empty text={t('bookings.none')} icon={ClipboardList}
          action={scope === 'active' ? <Button full={false} small label={t('tab.home')} onPress={() => nav.switchTab('home')} /> : undefined} />
      )}
      {q.data?.items.map((b) => <BookingRow key={b.id} b={b} onPress={() => nav.push('BookingDetail', { id: b.id })} />)}
    </Screen>
  );
}
