import { BadgeCheck, Check, ChevronRight, CreditCard, MapPin, Search, Timer, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BookingDto, Paginated, ServiceCategoryDto } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { useNav } from '../../lib/nav';
import { useServiceSelection } from '../../lib/serviceSelection';
import { useApi } from '../../lib/useApi';
import { Badge, BellButton, Card, Empty, ErrorState, IconTile, ListItem, Loading, Row, SectionTitle, T } from '../../ui';
import { BookingTicket, CATEGORY_ICON } from '../../ui/booking';
import { colors, fonts, radius, shadow, space } from '../../ui/theme';
import { SelectionBar } from './ServiceList';
import { areaName } from './TechnicianList';

export { CATEGORY_ICON };

export function CustomerHome() {
  const { t, pick, lang } = useI18n();
  const { me } = useAuth();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const catalog = useApi<{ items: ServiceCategoryDto[] }>('/services');
  const active = useApi<Paginated<BookingDto>>('/bookings?scope=active&pageSize=3', { pollMs: 8000 });
  const [q, setQ] = useState('');
  const sel = useServiceSelection();

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || !catalog.data) return [];
    return catalog.data.items.filter((c) => c.status === 'ACTIVE').flatMap((c) => c.services.filter((s) =>
      [s.nameEn, s.nameKm, c.nameEn, c.nameKm].some((x) => x.toLowerCase().includes(term))).map((s) => ({ s, c })));
  }, [q, catalog.data]);

  if (catalog.loading && !catalog.data) return <Loading />;
  if (catalog.error && !catalog.data) return <ErrorState error={catalog.error} onRetry={() => catalog.reload()} />;

  const firstName = me?.name?.split(' ')[0] ?? '';
  const home = me?.customerProfile?.homeArea;
  const trust = [
    { icon: BadgeCheck, text: t('tech.verified') },
    { icon: Timer, text: t('home.trustResponse') },
    { icon: CreditCard, text: t('home.trustPay') },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ paddingBottom: space(12) }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={{ backgroundColor: colors.deep, paddingTop: insets.top + space(4), paddingHorizontal: space(5), paddingBottom: space(12), borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T variant="small" color="#A5B4FC">{t('home.hello', { name: firstName })}</T>
            <Pressable onPress={() => nav.switchTab('profile')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <MapPin size={15} color={colors.accent} />
              <T weight="semibold" color={colors.white}>{home ? areaName(home, lang) : t('profile.home')}</T>
              <ChevronRight size={14} color="#A5B4FC" />
            </Pressable>
          </View>
          <BellButton light />
        </Row>
        <T variant="display" color={colors.white} style={{ marginTop: space(5) }}>{t('home.whatFix')}</T>
        <T variant="small" color="#A5B4FC" style={{ marginTop: space(1) }}>{t('home.pilot')}</T>
      </View>

      {/* Floating search */}
      <View style={{ marginTop: -space(7), marginHorizontal: space(4) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space(4), minHeight: 56, ...shadow.float }}>
          <Search size={20} color={colors.ink3} />
          <TextInput
            testID="service-search" value={q} onChangeText={setQ} placeholder={t('home.search')} placeholderTextColor={colors.ink4}
            accessibilityLabel={t('home.search')}
            style={{ flex: 1, minHeight: 54, fontSize: 16, fontFamily: fonts[lang].regular, color: colors.ink }}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: space(4) }}>
        {q.trim() !== '' && (
          <Card padded={false} style={{ marginTop: space(3), overflow: 'hidden' }}>
            {matches.length === 0 && <View style={{ padding: space(4) }}><T color={colors.ink3}>{t('home.noResults', { q })}</T></View>}
            {matches.map(({ s, c }, i) => (
              <View key={s.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.lineSoft } : undefined}>
                <ListItem icon={CATEGORY_ICON[c.icon] ?? Wrench} title={pick(s.nameEn, s.nameKm)}
                  subtitle={`${pick(c.nameEn, c.nameKm)} · $${Number(s.minPrice)}–$${Number(s.maxPrice)}`}
                  chevron={false} onPress={() => sel.toggle(s)}
                  right={sel.has(s.id) ? <Check size={20} color={colors.brand} strokeWidth={3} /> : undefined} />
              </View>
            ))}
          </Card>
        )}

        {sel.items.length > 0 && <Card style={{ marginTop: space(3) }}><SelectionBar /></Card>}

        {active.data && active.data.items.length > 0 && (
          <>
            <SectionTitle>{t('home.activeBooking')}</SectionTitle>
            {active.data.items.map((b) => (
              <View key={b.id} testID="active-booking">
                <BookingTicket b={b} perspective="customer" onPress={() => nav.switchTab('bookings', { name: 'BookingDetail', params: { id: b.id } })} />
              </View>
            ))}
          </>
        )}

        <SectionTitle>{t('home.categories')}</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
          {catalog.data?.items.map((c) => {
            const soon = c.status !== 'ACTIVE';
            const Icon = CATEGORY_ICON[c.icon] ?? Wrench;
            return (
              <Pressable
                key={c.id} testID={`category-${c.code}`} accessibilityRole="button" accessibilityState={{ disabled: soon }}
                accessibilityLabel={`${pick(c.nameEn, c.nameKm)}${soon ? `, ${t('home.comingSoon')}` : ''}`}
                disabled={soon}
                onPress={() => nav.push('ServiceList', { categoryId: c.id })}
                style={({ pressed }) => [{
                  width: '47%', flexGrow: 1, minHeight: 132, borderRadius: radius.lg, padding: space(4), justifyContent: 'space-between',
                  backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderStyle: soon ? 'dashed' : 'solid',
                }, !soon && shadow.card, pressed && { opacity: 0.9 }]}
              >
                <IconTile icon={Icon} tone={soon ? 'neutral' : 'info'} size={46} />
                <View>
                  <T weight="bold" color={soon ? colors.ink3 : colors.ink}>{pick(c.nameEn, c.nameKm)}</T>
                  {soon ? <View style={{ marginTop: space(1.5) }}><Badge label={t('home.comingSoon')} /></View>
                    : <T variant="caption" color={colors.ink3}>{t('home.servicesCount', { n: c.services.length })}</T>}
                </View>
              </Pressable>
            );
          })}
        </View>
        {catalog.data?.items.length === 0 && <Empty text={t('common.empty')} />}

        <View style={{ marginTop: space(6), backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space(4), gap: space(3) }}>
          {trust.map(({ icon: Icon, text }) => (
            <Row key={text} gap={3}>
              <Icon size={18} color={colors.success} />
              <T variant="small" color={colors.ink2} style={{ flex: 1 }}>{text}</T>
            </Row>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
