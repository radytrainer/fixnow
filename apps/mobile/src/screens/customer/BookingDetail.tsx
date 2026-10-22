import {
  CalendarDays, Camera, FileText, LifeBuoy, Map as MapIcon, MapPin, QrCode, Receipt, ShieldCheck, Star, Video, XCircle,
} from 'lucide-react-native';
import { useState } from 'react';
import { Image, Linking, Pressable, View } from 'react-native';
import { formatUsd, type BookingDto, type PublicTechnician } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { api, fileUrl } from '../../lib/api';
import { pickAndUpload, type PickedMedia } from '../../lib/media';
import { useNav } from '../../lib/nav';
import { useApi, useCountdown } from '../../lib/useApi';
import {
  Avatar, Banner, Button, Card, CountdownRing, DemoBadge, Divider, ErrorState, Field, IconTile, KeyValue, Loading, ProgressTrack,
  Row, Screen, SectionTitle, StatusBadge, Stars, T, errorText,
} from '../../ui';
import { BookedServices, serviceIcon } from '../../ui/booking';
import { colors, radius, space } from '../../ui/theme';
import { TechnicianCard, areaName } from './TechnicianList';

/** Vertical timeline of the job steps with timestamps. */
export function Timeline({ b }: { b: BookingDto }) {
  const { t, formatDate } = useI18n();
  const steps: Array<[string, string | null]> = [
    ['REQUESTED', b.createdAt], ['ACCEPTED', b.acceptedAt], ['CONFIRMED', b.startedAt], ['FINISHED', b.finishedAt], ['PAID', b.paidAt],
  ];
  return (
    <View>
      {steps.map(([s, at], i) => {
        const done = !!at;
        const nextDone = i < steps.length - 1 && !!steps[i + 1][1];
        return (
          <Row key={s} style={{ alignItems: 'flex-start' }}>
            <View style={{ alignItems: 'center', width: 20 }}>
              <View style={{
                width: 16, height: 16, borderRadius: 8, marginTop: 3, borderWidth: 2,
                borderColor: done ? colors.brand : colors.line, backgroundColor: done ? colors.brand : colors.surface,
              }} />
              {i < steps.length - 1 && <View style={{ width: 2, height: 28, backgroundColor: done && nextDone ? colors.brand : colors.line }} />}
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: space(2) }}>
              <T variant="small" weight={done ? 'semibold' : 'regular'} color={done ? colors.ink : colors.ink4}>{t(`status.${s}` as TranslationKey)}</T>
              {at && <T variant="caption" color={colors.ink3}>{formatDate(at)}</T>}
            </View>
          </Row>
        );
      })}
    </View>
  );
}

export function MediaStrip({ b, purpose }: { b: BookingDto; purpose: string }) {
  const items = b.media.filter((m) => m.purpose === purpose);
  if (!items.length) return null;
  return (
    <Row gap={2} style={{ flexWrap: 'wrap', marginTop: space(3) }}>
      {items.map((m) => (
        <Pressable key={m.id} accessibilityRole="imagebutton" onPress={() => Linking.openURL(fileUrl(m.url)!)}>
          {m.mediaType === 'PHOTO'
            ? <Image source={{ uri: fileUrl(m.url)! }} style={{ width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.lineSoft }} />
            : <View style={{ width: 76, height: 76, borderRadius: radius.md, backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}><Video size={26} color={colors.ink3} /></View>}
        </Pressable>
      ))}
    </Row>
  );
}

function Alternatives({ b, onRebooked }: { b: BookingDto; onRebooked: (id: string) => void }) {
  const { t } = useI18n();
  const alt = useApi<{ items: PublicTechnician[] }>(`/technicians?serviceIds=${b.services.map((s) => s.id).join(',')}&area=${b.serviceArea}&excludeId=${b.technician.id}`);
  const [error, setError] = useState<string | null>(null);
  const rebook = async (techId: string) => {
    setError(null);
    try {
      const nb = await api<BookingDto>(`/bookings/${b.id}/rebook`, { method: 'POST', body: { technicianId: techId } });
      onRebooked(nb.id);
    } catch (e) { setError(errorText(e, t)); }
  };
  return (
    <View>
      <SectionTitle>{t('detail.chooseAnother')}</SectionTitle>
      {error && <Banner text={error} tone="danger" />}
      {alt.data?.items.length === 0 && <T color={colors.ink3}>{t('detail.noAlternatives')}</T>}
      {alt.data?.items.map((tech) => <TechnicianCard key={tech.id} tech={tech} onPress={() => rebook(tech.id)} />)}
    </View>
  );
}

function RatingForm({ b, onDone }: { b: BookingDto; onDone: () => void }) {
  const { t } = useI18n();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Card testID="rating-card">
      <T variant="h3">{t('detail.rate')}</T>
      <T variant="small" color={colors.ink3}>{b.technician.name}</T>
      <Row gap={2} style={{ marginVertical: space(4), justifyContent: 'center' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} testID={`star-${n}`} accessibilityRole="button" accessibilityLabel={`${n} stars`} onPress={() => setScore(n)} hitSlop={6}>
            <Star size={38} color={n <= score ? '#F59E0B' : colors.line} fill={n <= score ? '#F59E0B' : 'transparent'} strokeWidth={1.6} />
          </Pressable>
        ))}
      </Row>
      <Field label="" placeholder={t('detail.commentPlaceholder')} value={comment} onChangeText={setComment} multiline />
      {error && <Banner text={error} tone="danger" />}
      <Button testID="submit-rating" label={t('detail.submitRating')} disabled={!score} onPress={async () => {
        setError(null);
        try { await api(`/bookings/${b.id}/ratings`, { method: 'POST', body: { score, comment: comment || undefined } }); onDone(); }
        catch (e) { setError(errorText(e, t)); }
      }} />
    </Card>
  );
}

function WarrantyForm({ b, onDone }: { b: BookingDto; onDone: () => void }) {
  const { t, formatDate } = useI18n();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  if (!b.warrantyEligibleUntil || new Date(b.warrantyEligibleUntil) < new Date()) return null;
  if (b.warranty && ['OPEN', 'ACCEPTED'].includes(b.warranty.status)) return null;
  return (
    <Card>
      <Row>
        <IconTile icon={ShieldCheck} tone="success" size={40} />
        <View style={{ flex: 1 }}>
          <T weight="semibold">{t('detail.warranty')}</T>
          <T variant="caption" color={colors.ink3}>{t('detail.warrantyUntil', { date: formatDate(b.warrantyEligibleUntil) })}</T>
        </View>
      </Row>
      {!open ? <View style={{ marginTop: space(3) }}><Button small variant="outline" label={t('detail.warranty')} onPress={() => setOpen(true)} /></View> : (
        <View style={{ marginTop: space(4) }}>
          <Field label={t('detail.warrantyDescribe')} value={description} onChangeText={setDescription} multiline />
          <Row gap={2} style={{ marginBottom: space(3) }}>
            {media.map((m) => <Image key={m.id} source={{ uri: m.uri }} style={{ width: 56, height: 56, borderRadius: radius.sm }} />)}
            <Button small full={false} variant="subtle" icon={Camera} label={t('book.addPhoto')} onPress={async () => {
              try { const m = await pickAndUpload('WARRANTY'); if (m) setMedia((x) => [...x, m]); } catch (e) { setError(errorText(e, t)); }
            }} />
          </Row>
          {error && <Banner text={error} tone="danger" />}
          <Button label={t('common.submit')} disabled={description.trim().length < 5} onPress={async () => {
            setError(null);
            try { await api(`/bookings/${b.id}/warranty`, { method: 'POST', body: { description, mediaIds: media.map((m) => m.id) } }); onDone(); }
            catch (e) { setError(errorText(e, t)); }
          }} />
        </View>
      )}
    </Card>
  );
}

export function CustomerBookingDetail() {
  const { t, pick, lang, formatDate } = useI18n();
  const nav = useNav();
  const id: string = nav.current.params?.id;
  const q = useApi<BookingDto>(`/bookings/${id}`, { pollMs: 4000 });
  const b = q.data;
  const msLeft = useCountdown(b?.status === 'REQUESTED' ? b.responseDeadlineAt : null, b?.serverNow);
  const [error, setError] = useState<string | null>(null);

  if (q.loading && !b) return <Loading />;
  if (q.error && !b) return <ErrorState error={q.error} onRetry={() => q.reload()} />;
  if (!b) return null;

  const cancel = async () => {
    setError(null);
    try { q.setData(await api<BookingDto>(`/bookings/${b.id}/cancel`, { method: 'POST', body: {} })); }
    catch (e) { setError(errorText(e, t)); q.reload(true); }
  };

  return (
    <Screen title={t('detail.title', { code: b.bookingCode })}>
      {error && <Banner text={error} tone="danger" />}

      {/* Status */}
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
          <View testID="countdown" style={{ marginTop: space(4), flexDirection: 'row', alignItems: 'center', gap: space(4), backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space(4) }}>
            <CountdownRing msLeft={msLeft} size={72} />
            <View style={{ flex: 1 }}>
              <T weight="semibold">{t('detail.waiting', { name: b.technician.name })}</T>
              <T variant="caption" color={colors.ink3} style={{ marginTop: 2 }}>{t('detail.timeLeft')}</T>
            </View>
          </View>
        ) : (
          <View style={{ marginTop: space(4) }}><ProgressTrack status={b.status} labels /></View>
        )}
      </Card>

      {(b.status === 'EXPIRED' || b.status === 'DECLINED') && (
        <>
          <Banner tone="warning" text={b.status === 'EXPIRED' ? t('detail.expiredTitle') : t('detail.declinedTitle')} />
          <Alternatives b={b} onRebooked={(nid) => nav.replace('BookingDetail', { id: nid })} />
        </>
      )}

      {b.status === 'FINISHED' && b.payment && (
        <View style={{ backgroundColor: colors.deep, borderRadius: radius.lg, padding: space(5), marginBottom: space(3) }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="small" color="#A5B4FC">{t('detail.amount')}</T>
            {b.payment.isDemo && <DemoBadge />}
          </Row>
          <T size={34} weight="bold" color={colors.white} style={{ marginTop: space(1) }}>{formatUsd(b.payment.amount)}</T>
          <View style={{ marginTop: space(4) }}>
            <Button testID="pay-now" variant="accent" icon={QrCode} label={t('detail.payNow')} onPress={() => nav.push('PaymentQR', { id: b.id })} />
          </View>
        </View>
      )}

      {b.payment && b.payment.status !== 'PENDING' && (
        <Card testID="receipt">
          <Row style={{ justifyContent: 'space-between', marginBottom: space(1) }}>
            <Row gap={2}><Receipt size={18} color={colors.ink2} /><T variant="h3">{t('detail.receipt')}</T></Row>
            {b.payment.isDemo && <DemoBadge />}
          </Row>
          <KeyValue label={t('pay.reference')} value={b.bookingCode} />
          <KeyValue label={t('detail.amount')} value={formatUsd(b.payment.amount)} />
          {b.payment.confirmedAt && <KeyValue label={t('detail.paidAt')} value={formatDate(b.payment.confirmedAt)} />}
          {b.payment.status === 'REFUNDED' && <Banner text={t('status.REFUNDED')} tone="danger" />}
        </Card>
      )}

      {b.status === 'PAID' && <RatingForm b={b} onDone={() => q.reload(true)} />}
      {b.rating && (
        <Card>
          <T variant="small" weight="semibold" color={colors.ink3}>{t('detail.rated')}</T>
          <Row gap={1} style={{ marginVertical: space(2) }}>
            {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={22} color="#F59E0B" fill={n <= b.rating!.score ? '#F59E0B' : 'transparent'} />)}
          </Row>
          {b.rating.comment && <T color={colors.ink2}>{b.rating.comment}</T>}
        </Card>
      )}
      {b.warranty && <Banner icon={ShieldCheck} text={t('detail.warrantyStatus', { status: b.warranty.status })} tone="info" />}
      <WarrantyForm b={b} onDone={() => q.reload(true)} />

      {/* People & place */}
      <Card>
        <Row>
          <Avatar name={b.technician.name} uri={fileUrl(b.technician.photoUrl)} size={46} />
          <View style={{ flex: 1 }}>
            <T variant="caption" color={colors.ink3}>{t('detail.technician')}</T>
            <T weight="semibold">{b.technician.name}</T>
          </View>
          <Stars value={b.technician.ratingAvg} />
        </Row>
        <Divider />
        <KeyValue icon={CalendarDays} label={t('detail.when')} value={formatDate(b.scheduledAt)} />
        <KeyValue icon={MapPin} label={t('detail.where')} value={`${areaName(b.serviceArea, lang)}${b.serviceAddressText ? ` · ${b.serviceAddressText}` : ''}`} />
        {b.serviceLat != null && (
          <View style={{ marginTop: space(1) }}>
            <Button small full={false} variant="subtle" icon={MapIcon} label={t('detail.viewMap')}
              onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${b.serviceLat},${b.serviceLng}`)} />
          </View>
        )}
        <Divider />
        <Row gap={2}><FileText size={16} color={colors.ink4} /><T variant="small" color={colors.ink3}>{t('detail.problem')}</T></Row>
        <T style={{ marginTop: space(1.5) }}>{b.problemDescription}</T>
        <MediaStrip b={b} purpose="PROBLEM" />
        {b.media.some((m) => m.purpose === 'COMPLETION') && (
          <>
            <Divider />
            <T variant="small" color={colors.ink3}>{t('jobs.completionPhotos')}</T>
            <MediaStrip b={b} purpose="COMPLETION" />
          </>
        )}
      </Card>

      <SectionTitle>{t('detail.timeline')}</SectionTitle>
      <Card><Timeline b={b} /></Card>

      <View style={{ gap: space(3), marginTop: space(2) }}>
        {(b.status === 'REQUESTED' || b.status === 'ACCEPTED') && <Button testID="cancel-booking" variant="danger" icon={XCircle} label={t('detail.cancel')} onPress={cancel} />}
        <Button variant="ghost" icon={LifeBuoy} label={t('detail.support')} onPress={() => nav.push('Support', { bookingId: b.id, bookingCode: b.bookingCode })} />
      </View>
    </Screen>
  );
}
