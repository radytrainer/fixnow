import { CalendarDays, Check, Inbox, Lock, MapPin, Power, RefreshCw, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BookingDto, Me, Paginated } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useNav } from '../../lib/nav';
import { useApi, useCountdown } from '../../lib/useApi';
import { Banner, BellButton, Button, Card, CountdownRing, Empty, IconTile, Row, SectionTitle, T, errorText } from '../../ui';
import { BookingTicket, serviceIcon } from '../../ui/booking';
import { colors, radius, space } from '../../ui/theme';
import { areaName } from '../customer/TechnicianList';

function IncomingCard({ b, onChanged }: { b: BookingDto; onChanged: () => void }) {
  const { t, pick, lang, formatDate } = useI18n();
  const nav = useNav();
  const msLeft = useCountdown(b.responseDeadlineAt, b.serverNow);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: 'accept' | 'decline') => {
    setError(null);
    try {
      await api(`/bookings/${b.id}/${action}`, { method: 'POST' });
      if (action === 'accept') nav.push('JobDetail', { id: b.id });
      onChanged();
    } catch (e) { setError(errorText(e, t)); onChanged(); }
  };
  return (
    <Card testID={`incoming-${b.bookingCode}`} onPress={() => nav.push('JobDetail', { id: b.id })} style={{ borderColor: '#FDD5B8', borderWidth: 1.5 }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Row gap={2.5}>
            <IconTile icon={serviceIcon(b.service.nameEn)} tone="accent" size={38} />
            <View style={{ flex: 1 }}>
              <T variant="h3" numberOfLines={1}>{pick(b.service.nameEn, b.service.nameKm)}</T>
              <T variant="caption" color={colors.ink3}>{b.bookingCode}</T>
            </View>
          </Row>
          <T variant="small" color={colors.ink2} numberOfLines={3} style={{ marginTop: space(3) }}>{b.problemDescription}</T>
        </View>
        <CountdownRing msLeft={msLeft} size={68} />
      </Row>
      <View style={{ marginTop: space(3), gap: space(1.5) }}>
        <Row gap={2}><MapPin size={15} color={colors.ink4} /><T variant="small" color={colors.ink2}>{areaName(b.serviceArea, lang)}</T></Row>
        <Row gap={2}><CalendarDays size={15} color={colors.ink4} /><T variant="small" color={colors.ink2}>{formatDate(b.scheduledAt)}</T></Row>
        <Row gap={2}><Lock size={15} color={colors.ink4} /><T variant="caption" color={colors.ink3}>{t('jobs.areaOnly')}</T></Row>
      </View>
      {error && <View style={{ marginTop: space(3) }}><Banner text={error} tone="danger" /></View>}
      <Row gap={3} style={{ marginTop: space(4) }}>
        <View style={{ flex: 1 }}><Button testID={`decline-${b.bookingCode}`} variant="danger" icon={X} label={t('jobs.decline')} onPress={() => act('decline')} disabled={msLeft <= 0} /></View>
        <View style={{ flex: 1.4 }}><Button testID={`accept-${b.bookingCode}`} icon={Check} label={t('jobs.accept')} onPress={() => act('accept')} disabled={msLeft <= 0} /></View>
      </Row>
    </Card>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: space(3) }}>
      <T variant="title" color={colors.white}>{value}</T>
      <T variant="caption" color="#A5B4FC">{label}</T>
    </View>
  );
}

export function Jobs() {
  const { t } = useI18n();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { me, setMe } = useAuth();
  const incoming = useApi<Paginated<BookingDto>>('/bookings?status=REQUESTED&pageSize=20', { pollMs: 4000 });
  const active = useApi<Paginated<BookingDto>>('/bookings?status=ACCEPTED,CONFIRMED,FINISHED&pageSize=20', { pollMs: 8000 });
  const available = me?.technicianProfile?.isAvailable ?? false;

  const toggle = async (v: boolean) => {
    try { setMe(await api<Me>('/technician/profile', { method: 'PATCH', body: { isAvailable: v } })); } catch { /* keep previous */ }
  };
  const refresh = () => { incoming.reload(true); active.reload(true); };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ paddingBottom: space(12) }} showsVerticalScrollIndicator={false}>
      <View style={{ backgroundColor: colors.deep, paddingTop: insets.top + space(4), paddingHorizontal: space(5), paddingBottom: space(6), borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <T variant="small" color="#A5B4FC">{t('home.hello', { name: me?.name?.split(' ')[0] ?? '' })}</T>
            <T variant="title" color={colors.white}>{t('tab.jobs')}</T>
          </View>
          <BellButton light />
        </Row>
        <Pressable onPress={() => toggle(!available)} accessibilityRole="switch" accessibilityState={{ checked: available }}
          style={{ marginTop: space(5), flexDirection: 'row', alignItems: 'center', gap: space(3), backgroundColor: available ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.08)', borderRadius: radius.lg, padding: space(4) }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: available ? '#22C55E' : 'rgba(255,255,255,0.15)' }}>
            <Power size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="semibold" color={colors.white}>{available ? t('jobs.available') : t('jobs.unavailable')}</T>
            <T variant="caption" color="#C7D2FE">{t('jobs.availabilityHint')}</T>
          </View>
          <Switch testID="availability-toggle" value={available} onValueChange={toggle} trackColor={{ true: '#22C55E', false: '#475569' }} thumbColor={colors.white} />
        </Pressable>
        <Row gap={3} style={{ marginTop: space(3) }}>
          <HeroStat value={incoming.data?.items.length ?? 0} label={t('jobs.incoming')} />
          <HeroStat value={active.data?.items.length ?? 0} label={t('jobs.active')} />
        </Row>
      </View>

      <View style={{ paddingHorizontal: space(4) }}>
        {incoming.error && <View style={{ marginTop: space(4) }}><Banner text={errorText(incoming.error, t)} tone="danger" /></View>}
        <SectionTitle right={<Button small full={false} variant="ghost" icon={RefreshCw} label={t('common.refresh')} onPress={refresh} />}>{t('jobs.incoming')}</SectionTitle>
        {incoming.data?.items.length === 0 && <Card><Empty text={t('jobs.noIncoming')} icon={Inbox} /></Card>}
        {incoming.data?.items.map((b) => <IncomingCard key={b.id} b={b} onChanged={refresh} />)}

        <SectionTitle>{t('jobs.active')}</SectionTitle>
        {active.data?.items.length === 0 && <T color={colors.ink3}>{t('jobs.noActive')}</T>}
        {active.data?.items.map((b) => <BookingTicket key={b.id} b={b} perspective="technician" onPress={() => nav.push('JobDetail', { id: b.id })} />)}
        <View style={{ marginTop: space(3) }}><Banner icon={Lock} text={t('jobs.privacyNote')} tone="neutral" /></View>
      </View>
    </ScrollView>
  );
}
