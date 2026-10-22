import * as Location from 'expo-location';
import { Camera, House, Lock, LocateFixed, MapPin, Send, Video, Zap } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { SERVICE_AREAS, fromCents, toCents, type BookingDto, type PublicTechnician, type ServiceDto } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { api, fileUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { pickAndUpload, type PickedMedia } from '../../lib/media';
import { useNav } from '../../lib/nav';
import { useServiceSelection } from '../../lib/serviceSelection';
import { Avatar, Banner, Button, Card, Chip, Field, Row, Screen, T, errorText } from '../../ui';
import { AreaPicker } from '../../ui/AreaPicker';
import { colors, radius, space } from '../../ui/theme';

const SLOTS = [8, 10, 12, 14, 16, 18];

/** Next 3 days for slot selection. */
function buildDays() {
  const now = new Date();
  return [0, 1, 2].map((i) => ({ key: `d${i}`, date: new Date(now.getTime() + i * 86400_000) }));
}

function slotIso(day: Date, hour: number) {
  // Interpret hour as Asia/Phnom_Penh local time (UTC+7, no DST).
  const ict = new Date(day.getTime() + 7 * 3600_000);
  return new Date(Date.UTC(ict.getUTCFullYear(), ict.getUTCMonth(), ict.getUTCDate(), hour - 7, 0, 0)).toISOString();
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Card>
      <Row gap={2.5} style={{ marginBottom: space(4) }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.deep, alignItems: 'center', justifyContent: 'center' }}>
          <T size={13} weight="bold" color={colors.white}>{n}</T>
        </View>
        <T variant="h3">{title}</T>
      </Row>
      {children}
    </Card>
  );
}

export function BookingForm() {
  const { t, pick, lang, formatDate } = useI18n();
  const nav = useNav();
  const { me } = useAuth();
  const tech: PublicTechnician = nav.current.params?.technician;
  const services: ServiceDto[] = nav.current.params?.services ?? (nav.current.params?.service ? [nav.current.params.service] : []);
  const selection = useServiceSelection();
  const minTotal = Number(fromCents(services.reduce((a, s) => a + toCents(s.minPrice ?? '0'), 0)));
  const maxTotal = Number(fromCents(services.reduce((a, s) => a + toCents(s.maxPrice ?? '0'), 0)));
  const home = me?.customerProfile;

  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dayIdx, setDayIdx] = useState(0);
  const [hour, setHour] = useState<number | 'asap'>('asap');
  const [area, setArea] = useState<string>(home?.homeArea ?? SERVICE_AREAS[0].code);
  const [address, setAddress] = useState(home?.homeAddressText ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(home?.homeLat != null ? { lat: home.homeLat, lng: home.homeLng! } : null);
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(buildDays, []);
  const nowIctHour = new Date(Date.now() + 7 * 3600_000).getUTCHours();

  const addMedia = async (kind: 'images' | 'videos') => {
    setError(null);
    setUploading(true);
    try {
      const m = await pickAndUpload('PROBLEM', kind);
      if (m) setMedia((x) => [...x, m]);
    } catch (e) { setError(errorText(e, t)); } finally { setUploading(false); }
  };

  const useGps = async () => {
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('Location permission denied');
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: Math.round(pos.coords.latitude * 1e6) / 1e6, lng: Math.round(pos.coords.longitude * 1e6) / 1e6 });
    } catch (e) { setError(errorText(e, t)); }
  };

  const submit = async () => {
    setError(null);
    const scheduledAt = hour === 'asap' ? new Date().toISOString() : slotIso(days[dayIdx].date, hour);
    try {
      const b = await api<BookingDto>('/bookings', {
        method: 'POST',
        body: {
          serviceIds: services.map((s) => s.id), technicianId: tech.id, problemDescription: description, scheduledAt, serviceArea: area,
          serviceAddressText: address, serviceLat: coords?.lat ?? null, serviceLng: coords?.lng ?? null, mediaIds: media.map((m) => m.id),
        },
      });
      selection.clear();
      nav.popToRoot();
      nav.switchTab('bookings', { name: 'BookingDetail', params: { id: b.id } });
    } catch (e) { setError(errorText(e, t)); }
  };

  const valid = description.trim().length >= 5 && address.trim().length >= 5;

  return (
    <Screen title={t('book.title')} footer={<Button testID="submit-booking" icon={Send} label={t('book.submit')} onPress={submit} disabled={!valid || uploading} />}>
      {/* Summary */}
      <View style={{ backgroundColor: colors.deep, borderRadius: radius.lg, padding: space(4), marginBottom: space(3) }}>
        <Row>
          <Avatar name={tech.name} uri={fileUrl(tech.photoUrl)} size={46} />
          <View style={{ flex: 1 }}>
            <T weight="bold" color={colors.white}>{tech.name}</T>
            <T variant="small" color="#A5B4FC">{services.length === 1 ? t('service.selectedOne') : t('service.selected', { n: services.length })}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T variant="caption" color="#A5B4FC">{t('service.from')}</T>
            <T weight="bold" color={colors.white}>${minTotal}–${maxTotal}</T>
          </View>
        </Row>
        <View testID="booking-services" style={{ marginTop: space(3), gap: space(1.5) }}>
          {services.map((s) => (
            <Row key={s.id} style={{ justifyContent: 'space-between' }}>
              <T variant="small" weight="semibold" color={colors.white} style={{ flex: 1 }}>• {pick(s.nameEn, s.nameKm)}</T>
              <T variant="caption" color="#A5B4FC">${Number(s.minPrice)}–${Number(s.maxPrice)}</T>
            </Row>
          ))}
        </View>
        <T variant="caption" color="#C7D2FE" style={{ marginTop: space(3) }}>{t('book.priceNote', { min: minTotal, max: maxTotal })}</T>
      </View>
      {error && <Banner text={error} tone="danger" />}

      <Step n={1} title={t('book.problem')}>
        <Field testID="problem-input" label="" placeholder={t('book.problemPlaceholder')} multiline value={description} onChangeText={setDescription} maxLength={1000} />
        <T variant="label" weight="semibold" color={colors.ink2} style={{ marginBottom: space(2) }}>
          {t('book.media')} <T variant="caption" color={colors.ink4}>· {t('common.optional')}</T>
        </T>
        {media.length > 0 && (
          <Row gap={2} style={{ flexWrap: 'wrap', marginBottom: space(3) }}>
            {media.map((m) => (
              <View key={m.id} style={{ width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.lineSoft, alignItems: 'center', justifyContent: 'center' }}>
                {m.mediaType === 'PHOTO' ? <Image source={{ uri: m.uri }} style={{ width: 72, height: 72 }} /> : <Video size={26} color={colors.ink3} />}
              </View>
            ))}
          </Row>
        )}
        <Row gap={2}>
          <View style={{ flex: 1 }}><Button small variant="outline" icon={Camera} label={uploading ? t('book.uploading') : t('book.addPhoto')} onPress={() => addMedia('images')} disabled={uploading || media.length >= 5} /></View>
          <View style={{ flex: 1 }}><Button small variant="outline" icon={Video} label={t('book.addVideo')} onPress={() => addMedia('videos')} disabled={uploading || media.length >= 5} /></View>
        </Row>
      </Step>

      <Step n={2} title={t('book.when')}>
        <Chip icon={Zap} label={t('book.asap')} selected={hour === 'asap'} onPress={() => setHour('asap')} />
        <Row gap={2} style={{ flexWrap: 'wrap', marginTop: space(3) }}>
          {days.map((d, i) => (
            <Chip key={d.key} label={i === 0 ? t('book.today') : i === 1 ? t('book.tomorrow') : formatDate(d.date, false)}
              selected={hour !== 'asap' && dayIdx === i} onPress={() => { setDayIdx(i); if (hour === 'asap') setHour(i === 0 ? SLOTS.find((h) => h > nowIctHour) ?? 18 : 10); }} />
          ))}
        </Row>
        {hour !== 'asap' && (
          <Row gap={2} style={{ flexWrap: 'wrap', marginTop: space(3) }}>
            {SLOTS.map((h) => (
              <Chip key={h} label={`${String(h).padStart(2, '0')}:00`} selected={hour === h} disabled={dayIdx === 0 && h <= nowIctHour} onPress={() => setHour(h)} />
            ))}
          </Row>
        )}
      </Step>

      <Step n={3} title={t('book.where')}>
        <AreaPicker testID="booking-area" label={t('book.area')} value={area} showCoverageNote
          onChange={(code) => { setArea(code); if (code !== area) setCoords(null); }} />
        <Field testID="address-input" icon={MapPin} label={t('book.address')} value={address} onChangeText={setAddress} multiline />
        <Row gap={2} style={{ flexWrap: 'wrap' }}>
          {home?.homeAddressText ? <Button small full={false} variant="subtle" icon={House} label={t('book.useHome')} onPress={() => {
            setAddress(home.homeAddressText ?? ''); if (home.homeArea) setArea(home.homeArea);
            if (home.homeLat != null) setCoords({ lat: home.homeLat, lng: home.homeLng! });
          }} /> : null}
          <Button small full={false} variant="subtle" icon={LocateFixed} label={t('book.useGps')} onPress={useGps} />
        </Row>
        {coords && <T variant="caption" color={colors.success} style={{ marginTop: space(2) }}>{t('book.gpsSet', { lat: coords.lat.toFixed(4), lng: coords.lng.toFixed(4) })}</T>}
        <View style={{ marginTop: space(4) }}><Banner icon={Lock} text={t('book.privacy')} tone="info" /></View>
      </Step>
    </Screen>
  );
}
