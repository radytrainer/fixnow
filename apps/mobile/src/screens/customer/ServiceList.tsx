import { ArrowRight, Check, Wrench } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import type { ServiceCategoryDto } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { useNav } from '../../lib/nav';
import { MAX_SERVICES_PER_BOOKING, useServiceSelection } from '../../lib/serviceSelection';
import { useApi } from '../../lib/useApi';
import { Banner, Button, ErrorState, IconTile, Loading, Row, Screen, T } from '../../ui';
import { CATEGORY_ICON } from '../../ui/booking';
import { colors, radius, shadow, space } from '../../ui/theme';

/** Sticky summary of the selection with the next step. Shown on Services and Home while something is selected. */
export function SelectionBar() {
  const { t, pick } = useI18n();
  const nav = useNav();
  const sel = useServiceSelection();
  if (!sel.items.length) return null;
  return (
    <View testID="selection-bar">
      <Row style={{ justifyContent: 'space-between', marginBottom: space(3) }}>
        <View style={{ flex: 1 }}>
          <T weight="bold">{sel.items.length === 1 ? t('service.selectedOne') : t('service.selected', { n: sel.items.length })}{sel.range ? ` · $${Number(sel.range.min)}–$${Number(sel.range.max)}` : ''}</T>
          <T variant="caption" color={colors.ink3} numberOfLines={1}>{sel.items.map((s) => pick(s.nameEn, s.nameKm)).join(' + ')}</T>
        </View>
        <Button small full={false} variant="ghost" label={t('service.clear')} onPress={sel.clear} />
      </Row>
      <Button testID="services-continue" icon={ArrowRight} label={t('service.continue')}
        onPress={() => nav.push('TechnicianList', { services: sel.items })} />
    </View>
  );
}

export function ServiceList() {
  const { t, pick } = useI18n();
  const nav = useNav();
  const sel = useServiceSelection();
  const catalog = useApi<{ items: ServiceCategoryDto[] }>('/services');
  const category = catalog.data?.items.find((c) => c.id === nav.current.params?.categoryId);

  if (catalog.loading && !catalog.data) return <Loading />;
  if (catalog.error || !category) return <ErrorState error={catalog.error ?? new Error('Not found')} onRetry={() => catalog.reload()} />;
  const Icon = CATEGORY_ICON[category.icon] ?? Wrench;
  const active = category.status === 'ACTIVE';
  const full = sel.items.length >= MAX_SERVICES_PER_BOOKING;

  return (
    <Screen title={pick(category.nameEn, category.nameKm)} subtitle={t('service.selectHint')} footer={sel.items.length ? <SelectionBar /> : undefined}>
      {!active && <Banner text={t('service.notBookable')} tone="warning" />}
      {category.services.map((s) => {
        const on = sel.has(s.id);
        const disabled = !active || (full && !on);
        return (
          <Pressable
            key={s.id} testID={`service-${s.nameEn}`} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }}
            disabled={disabled} onPress={() => sel.toggle(s)}
            style={({ pressed }) => [{
              backgroundColor: on ? colors.brandSoft : colors.surface, borderRadius: radius.lg, padding: space(4), marginBottom: space(3),
              borderWidth: on ? 1.5 : 1, borderColor: on ? colors.brand : colors.line, opacity: disabled && !on ? 0.5 : 1,
            }, !on && shadow.card, pressed && { opacity: 0.9 }]}
          >
            <Row style={{ alignItems: 'flex-start' }}>
              <IconTile icon={Icon} tone="info" size={44} />
              <View style={{ flex: 1 }}>
                <T variant="h3">{pick(s.nameEn, s.nameKm)}</T>
                <T variant="small" color={colors.ink3} style={{ marginTop: 2 }}>{pick(s.descriptionEn, s.descriptionKm)}</T>
                <Row gap={2} style={{ marginTop: space(2.5) }}>
                  <T variant="caption" color={colors.ink3}>{t('service.from')}</T>
                  <T weight="bold" color={colors.brand}>${Number(s.minPrice)} – ${Number(s.maxPrice)}</T>
                </Row>
              </View>
              <View style={{
                width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
                borderColor: on ? colors.brand : colors.ink4, backgroundColor: on ? colors.brand : 'transparent',
              }}>
                {on && <Check size={16} color={colors.white} strokeWidth={3} />}
              </View>
            </Row>
          </Pressable>
        );
      })}
      {full && <Banner text={t('service.maxReached', { n: MAX_SERVICES_PER_BOOKING })} tone="info" />}
    </Screen>
  );
}
