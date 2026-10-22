import { BadgeCheck, Briefcase, MapPin, SearchX } from 'lucide-react-native';
import { View } from 'react-native';
import type { PublicTechnician, ServiceDto } from '@fixnow/shared';
import { areaLabel } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { fileUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useNav } from '../../lib/nav';
import { useApi } from '../../lib/useApi';
import { Avatar, Badge, Card, Empty, ErrorState, Loading, Row, Screen, Stars, T } from '../../ui';
import { colors, space } from '../../ui/theme';

export function areaName(code: string, lang: 'en' | 'km', withGroup = false) {
  return areaLabel(code, lang, withGroup);
}

export function TechnicianCard({ tech, onPress }: { tech: PublicTechnician; onPress: () => void }) {
  const { t, lang } = useI18n();
  return (
    <Card onPress={onPress} testID={`tech-${tech.name}`}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View>
          <Avatar name={tech.name} uri={fileUrl(tech.photoUrl)} size={56} />
          <View style={{ position: 'absolute', right: -2, bottom: -2, backgroundColor: colors.white, borderRadius: 10 }}>
            <BadgeCheck size={20} color={colors.white} fill={colors.brand} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h3" numberOfLines={1} style={{ flex: 1 }}>{tech.name}</T>
            {tech.ratingAvg !== null ? <Stars value={tech.ratingAvg} count={tech.ratingCount} /> : <Badge label={t('tech.newTech')} tone="info" />}
          </Row>
          <Row gap={4} style={{ marginTop: space(1.5), flexWrap: 'wrap' }}>
            <Row gap={1}>
              <Briefcase size={14} color={colors.ink4} />
              <T variant="caption" color={colors.ink3}>{t('common.years', { n: tech.yearsExperience })}</T>
            </Row>
            <Row gap={1} style={{ flexShrink: 1, alignItems: 'flex-start' }}>
              <MapPin size={14} color={colors.ink4} style={{ marginTop: 2 }} />
              <T variant="caption" color={colors.ink3} style={{ flexShrink: 1 }}>
                {areaName(tech.serviceArea, lang, true)}{tech.distanceKm !== null ? ` · ${t('common.km', { n: tech.distanceKm })}` : ''}
              </T>
            </Row>
          </Row>
          {tech.bio ? <T variant="small" color={colors.ink2} numberOfLines={2} style={{ marginTop: space(2) }}>{tech.bio}</T> : null}
        </View>
      </Row>
    </Card>
  );
}

export function TechnicianList() {
  const { t, pick } = useI18n();
  const nav = useNav();
  const { me } = useAuth();
  const services: ServiceDto[] = nav.current.params?.services ?? (nav.current.params?.service ? [nav.current.params.service] : []);
  const home = me?.customerProfile;
  const loc = home?.homeLat != null ? `&lat=${home.homeLat}&lng=${home.homeLng}` : home?.homeArea ? `&area=${home.homeArea}` : '';
  const list = useApi<{ items: PublicTechnician[] }>(`/technicians?serviceIds=${services.map((s) => s.id).join(',')}${loc}`);
  const title = services.map((s) => pick(s.nameEn, s.nameKm)).join(' + ');

  return (
    <Screen title={title} subtitle={services.length > 1 ? t('tech.chooseForAll', { n: services.length }) : t('tech.choose')}>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorState error={list.error} onRetry={() => list.reload()} />}
      {list.data?.items.length === 0 && <Empty text={t('tech.none')} icon={SearchX} />}
      {list.data && list.data.items.length > 0 && (
        <T variant="caption" color={colors.ink3} style={{ marginBottom: space(3) }}>{t('tech.sortedNearest', { n: list.data.items.length })}</T>
      )}
      {list.data?.items.map((tech) => (
        <TechnicianCard key={tech.id} tech={tech} onPress={() => nav.push('TechnicianProfile', { technicianId: tech.id, services })} />
      ))}
    </Screen>
  );
}
