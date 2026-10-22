import { CalendarDays, Check, CircleCheck, ShieldCheck, X } from 'lucide-react-native';
import { useState } from 'react';
import { Image, View } from 'react-native';
import type { BookingDto, Paginated } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { api, fileUrl } from '../../lib/api';
import { useNav } from '../../lib/nav';
import { useApi } from '../../lib/useApi';
import { Badge, Banner, Button, Card, Empty, IconTile, Row, Screen, SectionTitle, T, errorText } from '../../ui';
import { BookingTicket } from '../../ui/booking';
import { colors, radius, space, statusTone } from '../../ui/theme';

interface Warranty {
  id: string; bookingId: string; bookingCode: string; status: string; description: string; createdAt: string;
  serviceNameEn: string; serviceNameKm: string; mediaUrls: string[];
}

export function Schedule() {
  const { t, pick, formatDate } = useI18n();
  const nav = useNav();
  const upcoming = useApi<Paginated<BookingDto>>('/bookings?status=ACCEPTED,CONFIRMED&pageSize=50', { pollMs: 10000 });
  const done = useApi<Paginated<BookingDto>>('/bookings?status=FINISHED,PAID,RATED,CLOSED&pageSize=20');
  const warranty = useApi<{ items: Warranty[] }>('/warranty', { pollMs: 15000 });
  const [error, setError] = useState<string | null>(null);
  const sorted = [...(upcoming.data?.items ?? [])].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const act = async (id: string, action: string) => {
    setError(null);
    try { await api(`/warranty/${id}/${action}`, { method: 'POST', body: {} }); warranty.reload(true); } catch (e) { setError(errorText(e, t)); }
  };

  return (
    <Screen title={t('schedule.title')} back={false}>
      <SectionTitle>{t('schedule.upcoming')}</SectionTitle>
      {sorted.length === 0 && <Card><Empty text={t('schedule.none')} icon={CalendarDays} /></Card>}
      {sorted.map((b) => <BookingTicket key={b.id} b={b} perspective="technician" onPress={() => nav.push('JobDetail', { id: b.id })} />)}

      {(warranty.data?.items.length ?? 0) > 0 && <SectionTitle>{t('jobs.warranty')}</SectionTitle>}
      {error && <Banner text={error} tone="danger" />}
      {warranty.data?.items.map((w) => (
        <Card key={w.id}>
          <Row style={{ alignItems: 'flex-start' }}>
            <IconTile icon={ShieldCheck} tone="info" size={40} />
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{pick(w.serviceNameEn, w.serviceNameKm)}</T>
                <Badge dot label={w.status} tone={statusTone(w.status)} />
              </Row>
              <T variant="caption" color={colors.ink4}>{w.bookingCode} · {formatDate(w.createdAt)}</T>
              <T variant="small" color={colors.ink2} style={{ marginTop: space(2) }}>{w.description}</T>
              {w.mediaUrls.length > 0 && (
                <Row gap={2} style={{ marginTop: space(2) }}>
                  {w.mediaUrls.map((u) => <Image key={u} source={{ uri: fileUrl(u)! }} style={{ width: 56, height: 56, borderRadius: radius.sm }} />)}
                </Row>
              )}
            </View>
          </Row>
          <Row gap={2} style={{ marginTop: space(3), flexWrap: 'wrap' }}>
            {w.status === 'OPEN' && <Button small full={false} icon={Check} label={t('jobs.warrantyAccept')} onPress={() => act(w.id, 'accept')} />}
            {(w.status === 'OPEN' || w.status === 'ACCEPTED') && <Button small full={false} variant="outline" icon={CircleCheck} label={t('jobs.warrantyResolve')} onPress={() => act(w.id, 'resolve')} />}
            {w.status === 'OPEN' && <Button small full={false} variant="danger" icon={X} label={t('jobs.warrantyReject')} onPress={() => act(w.id, 'reject')} />}
          </Row>
        </Card>
      ))}

      <SectionTitle>{t('schedule.done')}</SectionTitle>
      {done.data?.items.length === 0 && <T color={colors.ink3}>{t('common.empty')}</T>}
      {done.data?.items.map((b) => <BookingTicket key={b.id} b={b} perspective="technician" onPress={() => nav.push('JobDetail', { id: b.id })} />)}
    </Screen>
  );
}
