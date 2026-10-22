import { Award, Briefcase, Camera, IdCard, MapPin, Save, ShieldCheck, Star } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import type { Me } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { api, fileUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { pickAndUpload } from '../../lib/media';
import { useApi } from '../../lib/useApi';
import { Avatar, Badge, Banner, Button, Card, Field, KeyValue, Row, SectionTitle, T, errorText } from '../../ui';
import { colors, space, statusTone } from '../../ui/theme';
import { areaName } from '../customer/TechnicianList';
import { ProfileShell } from '../shared/Profile';

interface Reviews { average: number | null; count: number; items: Array<{ score: number; comment: string | null; createdAt: string; bookingCode: string; customerName: string }> }

/** Bio and public photo can be changed without re-verification; ID/certificates cannot. */
function EditPublicProfile() {
  const { t } = useI18n();
  const { me, setMe } = useAuth();
  const tp = me!.technicianProfile!;
  const [bio, setBio] = useState(tp.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);
  const save = async (body: Record<string, unknown>) => {
    setMsg(null);
    try { setMe(await api<Me>('/technician/profile', { method: 'PATCH', body })); setMsg({ text: t('common.saved'), tone: 'success' }); }
    catch (e) { setMsg({ text: errorText(e, t), tone: 'danger' }); }
  };
  return (
    <Card>
      <T variant="h3" style={{ marginBottom: space(3) }}>{t('tprofile.edit')}</T>
      {msg && <Banner text={msg.text} tone={msg.tone} />}
      <Row style={{ marginBottom: space(4) }}>
        <Avatar name={me!.name ?? '?'} uri={fileUrl(tp.photoUrl)} size={60} />
        <Button small full={false} variant="outline" icon={Camera} label={busy ? t('book.uploading') : t('tprofile.changePhoto')} disabled={busy} onPress={async () => {
          setBusy(true);
          try { const m = await pickAndUpload('PROFILE_PHOTO'); if (m) await save({ photoMediaId: m.id }); }
          catch (e) { setMsg({ text: errorText(e, t), tone: 'danger' }); } finally { setBusy(false); }
        }} />
      </Row>
      <Field testID="tech-bio" label={t('onboard.bio')} value={bio} onChangeText={setBio} multiline maxLength={500} />
      <Button testID="tech-bio-save" icon={Save} label={t('common.save')} onPress={() => save({ bio })} disabled={bio === (tp.bio ?? '')} />
    </Card>
  );
}

export function TechProfile() {
  const { t, lang, formatDate } = useI18n();
  const { me } = useAuth();
  const reviews = useApi<Reviews>('/technician/reviews');
  const tp = me?.technicianProfile;
  return (
    <ProfileShell photoUrl={tp?.photoUrl} subtitle={tp ? <Badge dot label={t(`techstatus.${tp.status}` as TranslationKey)} tone={statusTone(tp.status)} /> : undefined}>
      {tp && (
        <>
          <SectionTitle>{t('tprofile.status')}</SectionTitle>
          <Card>
            <KeyValue icon={ShieldCheck} label={t('tprofile.status')} value={<Badge dot label={t(`techstatus.${tp.status}` as TranslationKey)} tone={statusTone(tp.status)} />} />
            <KeyValue icon={MapPin} label={t('onboard.area')} value={areaName(tp.serviceArea, lang)} />
            <KeyValue icon={Briefcase} label={t('onboard.years')} value={String(tp.yearsExperience)} />
            <KeyValue icon={Award} label={t('onboard.certSummary')} value={tp.certificateSummary ?? '—'} />
            <KeyValue icon={IdCard} label={t('onboard.idPhoto')} value={tp.hasIdDocument ? t('tprofile.onFile') : '—'} />
          </Card>
          <EditPublicProfile />
        </>
      )}
      <SectionTitle right={reviews.data?.average != null ? (
        <Row gap={1}><Star size={16} color="#F59E0B" fill="#F59E0B" /><T weight="bold">{reviews.data.average.toFixed(2)}</T><T variant="caption" color={colors.ink3}>({reviews.data.count})</T></Row>
      ) : undefined}>{t('tprofile.ratings')}</SectionTitle>
      {reviews.data?.items.length === 0 && <T color={colors.ink3}>{t('tech.noReviews')}</T>}
      {reviews.data?.items.map((r, i) => (
        <Card key={i}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={2}>
              <Avatar name={r.customerName} size={32} />
              <View>
                <T weight="semibold">{r.customerName}</T>
                <T variant="caption" color={colors.ink4}>{r.bookingCode} · {formatDate(r.createdAt, false)}</T>
              </View>
            </Row>
            <Row gap={0.5}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} color="#F59E0B" fill={n <= r.score ? '#F59E0B' : 'transparent'} />)}</Row>
          </Row>
          {r.comment && <T variant="small" color={colors.ink2} style={{ marginTop: space(2) }}>{r.comment}</T>}
        </Card>
      ))}
    </ProfileShell>
  );
}
