import {
  CalendarDays, Camera, Check, CircleCheck, DollarSign, DoorClosed, FileText, Hourglass, LifeBuoy, Lock, MapPin, Navigation, Play, Star, UserRound, X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Image, Linking, Platform, View } from 'react-native';
import { formatUsd, splitCommission, type BookingDto, type EarningsDto } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { pickAndUpload, type PickedMedia } from '../../lib/media';
import { useNav } from '../../lib/nav';
import { useApi, useCountdown } from '../../lib/useApi';
import {
  Banner, Button, Card, CountdownRing, DemoBadge, Divider, ErrorState, Field, IconTile, KeyValue, Loading, ProgressTrack, Row, Screen,
  SectionTitle, StatusBadge, T, errorText,
} from '../../ui';
import { BookedServices, serviceIcon } from '../../ui/booking';
import { colors, radius, space } from '../../ui/theme';
import { MediaStrip, Timeline } from '../customer/BookingDetail';
import { areaName } from '../customer/TechnicianList';

function openMaps(b: BookingDto) {
  const dest = b.serviceLat != null ? `${b.serviceLat},${b.serviceLng}` : encodeURIComponent(`${b.serviceAddressText}, Phnom Penh`);
  const url = Platform.OS === 'android' && b.serviceLat != null
    ? `google.navigation:q=${dest}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`));
}

/** Gross → commission → net, shown as a split bar plus the exact figures. */
function SplitBar({ gross, commission, net, rate }: { gross: string; commission: string; net: string; rate: string | number }) {
  const { t } = useI18n();
  const pct = Number(gross) > 0 ? Number(commission) / Number(gross) : 0;
  return (
    <View>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginVertical: space(3) }}>
        <View style={{ flex: 1 - pct, backgroundColor: colors.success }} />
        <View style={{ width: 2, backgroundColor: colors.surface }} />
        <View style={{ flex: pct, backgroundColor: colors.ink4 }} />
      </View>
      <KeyValue label={t('earn.gross')} value={formatUsd(gross)} />
      <KeyValue label={t('earn.commission', { rate: Number(rate) })} value={`− ${formatUsd(commission)}`} />
      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={2}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.success }} /><T weight="semibold">{t('earn.net')}</T></Row>
        <T variant="title" color={colors.success}>{formatUsd(net)}</T>
      </Row>
    </View>
  );
}

export function JobDetail() {
  const { t, pick, lang, formatDate } = useI18n();
  const nav = useNav();
  const { me } = useAuth();
  const q = useApi<BookingDto>(`/bookings/${nav.current.params?.id}`, { pollMs: 5000 });
  const b = q.data;
  const msLeft = useCountdown(b?.status === 'REQUESTED' ? b.responseDeadlineAt : null, b?.serverNow);
  const rate = useApi<EarningsDto>('/technician/earnings').data?.commissionRate ?? '15';
  const [amount, setAmount] = useState('');
  const [photos, setPhotos] = useState<PickedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (q.loading && !b) return <Loading />;
  if (q.error && !b) return <ErrorState error={q.error} onRetry={() => q.reload()} />;
  if (!b) return null;

  const act = async (path: string, body?: unknown) => {
    setError(null);
    try { q.setData(await api<BookingDto>(`/bookings/${b.id}/${path}`, { method: 'POST', body })); }
    catch (e) { setError(errorText(e, t)); q.reload(true); }
  };

  const amountOk = /^\d{1,6}(\.\d{1,2})?$/.test(amount);
  const preview = amountOk ? splitCommission(amount, rate) : null;
  const priceHint = b.service.minPrice ? `$${Number(b.service.minPrice)} – $${Number(b.service.maxPrice)}` : '';
  const working = b.status === 'ACCEPTED' || b.status === 'CONFIRMED';

  return (
    <Screen title={b.bookingCode} subtitle={pick(b.service.nameEn, b.service.nameKm)}>
      {error && <Banner text={error} tone="danger" />}

      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <IconTile icon={serviceIcon(b.service.nameEn)} tone="info" size={46} />
          <View style={{ flex: 1 }}>
            <T variant="h3">{pick(b.service.nameEn, b.service.nameKm)}</T>
            <View style={{ marginTop: space(1.5) }}><StatusBadge status={b.status} /></View>
          </View>
        </Row>
        <BookedServices b={b} />
        {b.status === 'REQUESTED' ? (
          <View style={{ marginTop: space(4) }}>
            <Row gap={4} style={{ backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space(4) }}>
              <CountdownRing testID="job-countdown" msLeft={msLeft} size={72} />
              <T weight="semibold" style={{ flex: 1 }}>{t('jobs.respondIn')}</T>
            </Row>
            <Row gap={3} style={{ marginTop: space(4) }}>
              <View style={{ flex: 1 }}><Button variant="danger" icon={X} label={t('jobs.decline')} onPress={() => act('decline')} disabled={msLeft <= 0} /></View>
              <View style={{ flex: 1.4 }}><Button testID="job-accept" icon={Check} label={t('jobs.accept')} onPress={() => act('accept')} disabled={msLeft <= 0} /></View>
            </Row>
          </View>
        ) : (
          <View style={{ marginTop: space(4) }}><ProgressTrack status={b.status} labels /></View>
        )}
        {b.status === 'EXPIRED' && <View style={{ marginTop: space(3) }}><Banner text={t('jobs.expired')} tone="neutral" /></View>}
      </Card>

      {/* Customer & place: private details unlock only after accepting */}
      <Card>
        <Row>
          <IconTile icon={b.customer ? UserRound : Lock} tone={b.customer ? 'violet' : 'neutral'} size={42} />
          <View style={{ flex: 1 }}>
            <T variant="caption" color={colors.ink3}>{t('detail.customer')}</T>
            <T weight="semibold" testID="job-customer">{b.customer?.name ?? t('jobs.hiddenUntilAccept')}</T>
          </View>
        </Row>
        <Divider />
        <KeyValue icon={CalendarDays} label={t('detail.when')} value={formatDate(b.scheduledAt)} />
        <KeyValue icon={MapPin} label={t('book.area')} value={areaName(b.serviceArea, lang)} />
        {b.serviceAddressText ? (
          <View style={{ marginTop: space(2), backgroundColor: colors.lineSoft, borderRadius: radius.md, padding: space(3.5) }}>
            <T variant="caption" color={colors.ink3}>{t('detail.where')}</T>
            <T weight="semibold" testID="job-address" style={{ marginTop: 2 }}>{b.serviceAddressText}</T>
            {working && (
              <View style={{ marginTop: space(3) }}><Button testID="job-navigate" variant="secondary" icon={Navigation} label={t('jobs.navigate')} onPress={() => openMaps(b)} /></View>
            )}
          </View>
        ) : <View style={{ marginTop: space(2) }}><Banner icon={Lock} text={t('jobs.areaOnly')} tone="info" /></View>}
        <Divider />
        <Row gap={2}><FileText size={16} color={colors.ink4} /><T variant="small" color={colors.ink3}>{t('detail.problem')}</T></Row>
        <T style={{ marginTop: space(1.5) }}>{b.problemDescription}</T>
        <MediaStrip b={b} purpose="PROBLEM" />
      </Card>

      {b.status === 'ACCEPTED' && <Button testID="job-start" variant="secondary" icon={Play} label={t('jobs.start')} onPress={() => act('start')} />}

      {working && (
        <Card style={{ marginTop: space(3) }}>
          <Row gap={2.5} style={{ marginBottom: space(4) }}>
            <IconTile icon={CircleCheck} tone="accent" size={36} />
            <T variant="h3">{t('jobs.finish')}</T>
          </Row>
          <Field testID="finish-amount" icon={DollarSign} label={t('jobs.finalAmount')} value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))}
            keyboardType="decimal-pad" placeholder="25.00" hint={priceHint} />
          {preview && <View style={{ marginBottom: space(4) }}><SplitBar gross={preview.amount} commission={preview.commissionAmount} net={preview.technicianNet} rate={rate} /></View>}
          <T variant="label" weight="semibold" color={colors.ink2} style={{ marginBottom: space(2) }}>{t('jobs.completionPhotos')} <T variant="caption" color={colors.ink4}>· {t('common.optional')}</T></T>
          <Row gap={2} style={{ flexWrap: 'wrap', marginBottom: space(4) }}>
            {photos.map((p) => <Image key={p.id} source={{ uri: p.uri }} style={{ width: 64, height: 64, borderRadius: radius.sm }} />)}
            <Button small full={false} variant="outline" icon={Camera} label={uploading ? t('book.uploading') : t('book.addPhoto')} disabled={uploading || photos.length >= 5} onPress={async () => {
              setUploading(true);
              try { const m = await pickAndUpload('COMPLETION'); if (m) setPhotos((x) => [...x, m]); } catch (e) { setError(errorText(e, t)); } finally { setUploading(false); }
            }} />
          </Row>
          <Button testID="job-finish" variant="accent" icon={Check} label={t('jobs.finish')} disabled={!amountOk || uploading}
            onPress={() => act('finish', { amount, completionMediaIds: photos.map((p) => p.id) })} />
          <View style={{ marginTop: space(2) }}>
            <Button small variant="ghost" icon={DoorClosed} label={t('jobs.notAvailable')} onPress={() => act('customer-not-available')} />
          </View>
        </Card>
      )}

      {b.payment && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={2}>
              {b.payment.status === 'PENDING' ? <Hourglass size={18} color={colors.accent} /> : <CircleCheck size={18} color={colors.success} />}
              <T weight="semibold">{b.payment.status === 'PENDING' ? t('jobs.waitingPayment') : t('pay.confirmed')}</T>
            </Row>
            {b.payment.isDemo && <DemoBadge />}
          </Row>
          <SplitBar gross={b.payment.amount} commission={b.payment.commissionAmount} net={b.payment.technicianNet} rate={b.payment.commissionRate} />
        </Card>
      )}
      {b.rating && (
        <Card>
          <T variant="small" weight="semibold" color={colors.ink3}>{t('tprofile.ratings')}</T>
          <Row gap={1} style={{ marginVertical: space(2) }}>
            {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={20} color="#F59E0B" fill={n <= b.rating!.score ? '#F59E0B' : 'transparent'} />)}
          </Row>
          {b.rating.comment && <T color={colors.ink2}>{b.rating.comment}</T>}
        </Card>
      )}
      <MediaStrip b={b} purpose="COMPLETION" />

      <SectionTitle>{t('detail.timeline')}</SectionTitle>
      <Card><Timeline b={b} /></Card>
      <Button variant="ghost" icon={LifeBuoy} label={t('detail.support')} onPress={() => nav.push('Support', { bookingId: b.id, bookingCode: b.bookingCode })} />
      {me?.technicianProfile?.status !== 'APPROVED' && <Banner text={t('pending.body')} tone="warning" />}
    </Screen>
  );
}
