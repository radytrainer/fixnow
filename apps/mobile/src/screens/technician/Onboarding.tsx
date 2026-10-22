import { Award, Camera, CircleCheck, IdCard, Lock, Send, User, UserRound, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { SERVICE_AREAS, type Me, type ServiceCategoryDto } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { pickAndUpload, type PickedMedia } from '../../lib/media';
import { useNav } from '../../lib/nav';
import { useApi } from '../../lib/useApi';
import { Banner, Button, Card, Chip, Field, IconTile, Row, Screen, T, errorText } from '../../ui';
import { AreaPicker } from '../../ui/AreaPicker';
import { CATEGORY_ICON } from '../../ui/booking';
import { colors, radius, space } from '../../ui/theme';

function UploadSlot({ label, purpose, value, onChange, icon: Icon }: { label: string; purpose: string; value: PickedMedia | null; onChange: (m: PickedMedia) => void; icon: LucideIcon }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <View style={{ marginBottom: space(4) }}>
      <T variant="label" weight="semibold" color={colors.ink2} style={{ marginBottom: space(2) }}>{label}</T>
      <Row>
        {value ? <Image source={{ uri: value.uri }} style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.lineSoft }} />
          : <View style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.lineSoft, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink4, alignItems: 'center', justifyContent: 'center' }}><Icon size={24} color={colors.ink3} /></View>}
        <Button small full={false} variant={value ? 'subtle' : 'outline'} icon={value ? CircleCheck : Camera}
          label={busy ? t('book.uploading') : value ? t('onboard.picked') : t('onboard.pick')} disabled={busy} onPress={async () => {
            setErr(null); setBusy(true);
            try { const m = await pickAndUpload(purpose); if (m) onChange(m); } catch (e) { setErr(errorText(e, t)); } finally { setBusy(false); }
          }} />
      </Row>
      {err && <T variant="caption" color={colors.danger} style={{ marginTop: space(1) }}>{err}</T>}
    </View>
  );
}

function Section({ icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <Card>
      <Row gap={2.5} style={{ marginBottom: space(4) }}>
        <IconTile icon={icon} tone="info" size={34} />
        <T variant="h3">{title}</T>
      </Row>
      {children}
    </Card>
  );
}

export function Onboarding() {
  const { t, pick, lang } = useI18n();
  const { me, setMe } = useAuth();
  const nav = useNav();
  const prev = me?.technicianProfile;
  const catalog = useApi<{ items: ServiceCategoryDto[] }>('/services');
  const [name, setName] = useState(me?.name ?? '');
  const [years, setYears] = useState(prev ? String(prev.yearsExperience) : '');
  const [area, setArea] = useState(prev?.serviceArea ?? SERVICE_AREAS[0].code);
  const [serviceIds, setServiceIds] = useState<string[]>(prev?.serviceIds ?? []);
  const [bio, setBio] = useState(prev?.bio ?? '');
  const [idNumber, setIdNumber] = useState(prev?.idDocumentNumber ?? '');
  const [certSummary, setCertSummary] = useState(prev?.certificateSummary ?? '');
  const [idDoc, setIdDoc] = useState<PickedMedia | null>(null);
  const [cert, setCert] = useState<PickedMedia | null>(null);
  const [photo, setPhoto] = useState<PickedMedia | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => setServiceIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const valid = name.trim().length >= 2 && years !== '' && serviceIds.length > 0 && idNumber.trim().length >= 4 && !!idDoc;

  const submit = async () => {
    setError(null);
    try {
      const m = await api<Me>('/technicians/register', {
        method: 'POST',
        body: {
          name, bio, yearsExperience: Number(years), serviceArea: area, serviceIds, certificateSummary: certSummary,
          idDocumentNumber: idNumber, idDocumentMediaId: idDoc!.id, certificateMediaId: cert?.id, photoMediaId: photo?.id,
        },
      });
      setMe(m);
      if (nav.stack.length > 1) nav.pop();
    } catch (e) { setError(errorText(e, t)); }
  };

  return (
    <Screen title={t('onboard.title')} footer={<Button testID="onboard-submit" icon={Send} label={t('onboard.submit')} disabled={!valid} onPress={submit} />}>
      <View style={{ backgroundColor: colors.deep, borderRadius: radius.lg, padding: space(4), marginBottom: space(3) }}>
        <T variant="small" color="#E0E7FF">{t('onboard.intro')}</T>
      </View>
      {prev?.status === 'REJECTED' && prev.rejectionReason && <Banner tone="danger" text={t('pending.rejectedReason', { reason: prev.rejectionReason })} />}
      {error && <Banner text={error} tone="danger" />}

      <Section icon={UserRound} title={t('onboard.about')}>
        <Field icon={User} label={t('onboard.name')} value={name} onChangeText={setName} testID="onboard-name" />
        <Field label={t('onboard.years')} value={years} onChangeText={(v) => setYears(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" testID="onboard-years" />
        <AreaPicker testID="onboard-area" label={t('onboard.area')} value={area} onChange={setArea} showCoverageNote />
        <Field label={`${t('onboard.bio')} (${t('common.optional')})`} value={bio} onChangeText={setBio} multiline />
      </Section>

      <Section icon={Award} title={t('onboard.services')}>
        {catalog.data?.items.filter((c) => c.status === 'ACTIVE').map((c) => (
          <View key={c.id} style={{ marginBottom: space(3) }}>
            <T variant="small" weight="semibold" color={colors.ink3} style={{ marginBottom: space(2) }}>{pick(c.nameEn, c.nameKm)}</T>
            <Row gap={2} style={{ flexWrap: 'wrap' }}>
              {c.services.map((s) => (
                <Chip key={s.id} testID={`onboard-service-${s.nameEn}`} icon={CATEGORY_ICON[c.icon]} label={pick(s.nameEn, s.nameKm)}
                  selected={serviceIds.includes(s.id)} onPress={() => toggle(s.id)} />
              ))}
            </Row>
          </View>
        ))}
      </Section>

      <Section icon={IdCard} title={t('onboard.verification')}>
        <Banner icon={Lock} text={t('onboard.private')} tone="info" />
        <Field icon={IdCard} label={t('onboard.idNumber')} value={idNumber} onChangeText={setIdNumber} testID="onboard-id" />
        <UploadSlot icon={IdCard} label={t('onboard.idPhoto')} purpose="ID_DOCUMENT" value={idDoc} onChange={setIdDoc} />
        <Field icon={Award} label={t('onboard.certSummary')} value={certSummary} onChangeText={setCertSummary} />
        <UploadSlot icon={Award} label={`${t('onboard.certPhoto')} (${t('common.optional')})`} purpose="CERTIFICATE" value={cert} onChange={setCert} />
        <UploadSlot icon={UserRound} label={`${t('onboard.profilePhoto')} (${t('common.optional')})`} purpose="PROFILE_PHOTO" value={photo} onChange={setPhoto} />
      </Section>
    </Screen>
  );
}
