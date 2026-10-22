import { Award, BadgeCheck, Briefcase, CalendarCheck, MapPin, Star } from 'lucide-react-native';
import { View } from 'react-native';
import type { PublicTechnician, ServiceDto } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { fileUrl } from '../../lib/api';
import { useNav } from '../../lib/nav';
import { useApi } from '../../lib/useApi';
import { Avatar, Badge, Button, Card, Divider, ErrorState, KeyValue, Loading, Row, Screen, SectionTitle, T } from '../../ui';
import { colors, radius, space } from '../../ui/theme';
import { areaName } from './TechnicianList';

type Profile = PublicTechnician & { reviews: Array<{ score: number; comment: string | null; createdAt: string; customerName: string }> };

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: space(3) }}>
      <T variant="title">{value}</T>
      <T variant="caption" color={colors.ink3} center>{label}</T>
    </View>
  );
}

export function TechnicianProfile() {
  const { t, lang, formatDate } = useI18n();
  const nav = useNav();
  const services: ServiceDto[] = nav.current.params?.services ?? (nav.current.params?.service ? [nav.current.params.service] : []);
  const p = useApi<Profile>(`/technicians/${nav.current.params?.technicianId}`);

  if (p.loading && !p.data) return <Loading />;
  if (p.error || !p.data) return <ErrorState error={p.error} onRetry={() => p.reload()} />;
  const tech = p.data;

  return (
    <Screen
      title={tech.name}
      footer={<Button testID="book-technician" icon={CalendarCheck} label={t('tech.book', { name: tech.name.split(' ')[0] })} onPress={() => nav.push('BookingForm', { technician: tech, services })} />}
    >
      <Card style={{ alignItems: 'center', paddingTop: space(6) }}>
        <Avatar name={tech.name} uri={fileUrl(tech.photoUrl)} size={88} />
        <T variant="title" style={{ marginTop: space(3) }}>{tech.name}</T>
        <View style={{ marginTop: space(2) }}>
          <Row gap={1.5} style={{ backgroundColor: colors.brandSoft, paddingHorizontal: space(3), paddingVertical: space(1), borderRadius: radius.pill }}>
            <BadgeCheck size={15} color={colors.brand} />
            <T variant="caption" weight="semibold" color={colors.brandPressed}>{t('tech.verified')}</T>
          </Row>
        </View>
        <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: space(4), borderTopWidth: 1, borderTopColor: colors.lineSoft }}>
          <Metric value={tech.ratingAvg !== null ? `★ ${tech.ratingAvg.toFixed(1)}` : '—'} label={`${tech.ratingCount} ${t('tech.reviews').toLowerCase()}`} />
          <View style={{ width: 1, backgroundColor: colors.lineSoft }} />
          <Metric value={String(tech.yearsExperience)} label={t('tech.yearsLabel')} />
          <View style={{ width: 1, backgroundColor: colors.lineSoft }} />
          <Metric value={String(tech.jobsCompleted)} label={t('tech.jobsLabel')} />
        </View>
      </Card>

      <Card>
        {tech.bio ? <><T color={colors.ink2}>{tech.bio}</T><Divider /></> : null}
        <KeyValue icon={MapPin} label={t('tech.area')} value={areaName(tech.serviceArea, lang)} />
        <KeyValue icon={Award} label={t('tech.certificates')} value={tech.certificateSummary ?? '—'} />
        <KeyValue icon={Briefcase} label={t('onboard.years')} value={String(tech.yearsExperience)} />
      </Card>

      <SectionTitle right={tech.ratingCount > 0 ? <Badge label={`${tech.ratingCount}`} tone="neutral" /> : undefined}>{t('tech.reviews')}</SectionTitle>
      {tech.reviews.length === 0 && <T color={colors.ink3}>{t('tech.noReviews')}</T>}
      {tech.reviews.map((r, i) => (
        <Card key={i}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={2}>
              <Avatar name={r.customerName} size={32} />
              <T weight="semibold">{r.customerName}</T>
            </Row>
            <Row gap={0.5}>
              {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} color="#F59E0B" fill={n <= r.score ? '#F59E0B' : 'transparent'} />)}
            </Row>
          </Row>
          {r.comment && <T variant="small" color={colors.ink2} style={{ marginTop: space(2) }}>{r.comment}</T>}
          <T variant="caption" color={colors.ink4} style={{ marginTop: space(2) }}>{formatDate(r.createdAt, false)}</T>
        </Card>
      ))}
    </Screen>
  );
}
