import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SERVICE_AREAS, areaLabel, findArea, type ServiceArea } from '@fixnow/shared';
import { useI18n } from '../i18n';
import { Badge, Banner, Row, T } from './index';
import { colors, fonts, radius, space } from './theme';

/** Area selector for all of Cambodia: shows the choice, opens a searchable list grouped by province/khan. */
export function AreaPicker({ value, onChange, label, testID, showCoverageNote }: {
  value: string; onChange: (code: string) => void; label: string; testID?: string; showCoverageNote?: boolean;
}) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = findArea(value);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (x: ServiceArea) => !term || [x.name_en, x.name_km, x.group_en, x.group_km].some((v) => v.toLowerCase().includes(term));
    const out: Array<{ title: string; items: ServiceArea[] }> = [];
    for (const x of SERVICE_AREAS.filter(match)) {
      const title = lang === 'km' ? x.group_km : x.group_en;
      const g = out.find((o) => o.title === title);
      if (g) g.items.push(x); else out.push({ title, items: [x] });
    }
    return out;
  }, [q, lang]);

  const choose = (code: string) => { onChange(code); setOpen(false); setQ(''); };

  return (
    <View style={{ marginBottom: space(4) }}>
      <T variant="label" weight="semibold" color={colors.ink2} style={{ marginBottom: space(1.5) }}>{label}</T>
      <Pressable
        testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${areaLabel(value, lang, true)}`} onPress={() => setOpen(true)}
        style={({ pressed }) => [{
          flexDirection: 'row', alignItems: 'center', gap: space(2.5), minHeight: 52, borderWidth: 1, borderColor: colors.line,
          borderRadius: radius.md, paddingHorizontal: space(3.5), backgroundColor: colors.surface,
        }, pressed && { borderColor: colors.brand }]}
      >
        <MapPin size={18} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <T weight="semibold" numberOfLines={1}>{selected ? (lang === 'km' ? selected.name_km : selected.name_en) : t('area.choose')}</T>
          {selected && <T variant="caption" color={colors.ink3} numberOfLines={1}>{lang === 'km' ? selected.group_km : selected.group_en}</T>}
        </View>
        {selected?.pilot && <View style={{ justifyContent: 'center' }}><Badge label={t('area.pilot')} tone="success" /></View>}
        <ChevronDown size={18} color={colors.ink3} />
      </Pressable>
      {showCoverageNote && selected && !selected.pilot && (
        <View style={{ marginTop: space(2) }}><Banner tone="info" text={t('area.limitedNote')} /></View>
      )}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} transparent={Platform.OS === 'web'}>
        <View style={{ flex: 1, backgroundColor: Platform.OS === 'web' ? 'rgba(15,23,42,0.35)' : colors.canvas, alignItems: 'center' }}>
          <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 430 : undefined, backgroundColor: colors.canvas }}>
            <View style={{ paddingTop: insets.top + space(3), paddingHorizontal: space(4), paddingBottom: space(3), backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.lineSoft }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: space(3) }}>
                <T variant="title">{t('area.choose')}</T>
                <Pressable testID="area-close" accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} hitSlop={10}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lineSoft }}>
                  <X size={20} color={colors.ink} />
                </Pressable>
              </Row>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space(3), backgroundColor: colors.canvas }}>
                <Search size={18} color={colors.ink3} />
                <TextInput
                  testID="area-search" value={q} onChangeText={setQ} placeholder={t('area.search')} placeholderTextColor={colors.ink4} autoFocus={Platform.OS === 'web'}
                  style={{ flex: 1, minHeight: 46, fontSize: 16, fontFamily: fonts[lang].regular, color: colors.ink, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) }}
                />
              </View>
            </View>
            <ScrollView contentContainerStyle={{ padding: space(4), paddingBottom: insets.bottom + space(10) }} keyboardShouldPersistTaps="handled">
              {groups.length === 0 && <T color={colors.ink3} center style={{ marginTop: space(8) }}>{t('area.noResults')}</T>}
              {groups.map((g) => (
                <View key={g.title} style={{ marginBottom: space(4) }}>
                  <T variant="caption" weight="bold" color={colors.ink3} style={{ marginBottom: space(2), textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.title}</T>
                  <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
                    {g.items.map((x, i) => {
                      const on = x.code === value;
                      return (
                        <Pressable key={x.code} testID={`area-${x.code}`} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => choose(x.code)}
                          style={({ pressed }) => [{
                            flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 52, paddingHorizontal: space(4),
                            backgroundColor: on ? colors.brandSoft : pressed ? colors.lineSoft : colors.surface,
                          }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.lineSoft }]}>
                          <T weight={on ? 'semibold' : 'regular'} color={on ? colors.brandPressed : colors.ink} style={{ flex: 1 }}>{lang === 'km' ? x.name_km : x.name_en}</T>
                          {x.pilot && <View style={{ justifyContent: 'center' }}><Badge label={t('area.pilot')} tone="success" /></View>}
                          {on && <Check size={18} color={colors.brand} strokeWidth={3} />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
