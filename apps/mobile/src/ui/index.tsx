import {
  Bell, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Info, Inbox, Star, TriangleAlert, type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { ApiError } from '../lib/api';
import { useNav } from '../lib/nav';
import { useNotifications } from '../lib/notifications';
import { JOB_STEPS, colors, fonts, jobStepIndex, radius, shadow, space, statusTone, toneColors, type, type Tone } from './theme';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
type Variant = keyof typeof type;

/* ------------------------------------------------------------------ text */

/** Text in the brand font; switches to Noto Sans Khmer (taller line height) when the app language is Khmer. */
export function T({ children, variant, weight, size, color = colors.ink, style, numberOfLines, center, testID }: {
  children: ReactNode; variant?: Variant; weight?: Weight; size?: number; color?: string; style?: StyleProp<TextStyle>;
  numberOfLines?: number; center?: boolean; testID?: string;
}) {
  const { lang } = useI18n();
  const v = variant ? type[variant] : type.body;
  const fs = size ?? v.size;
  const fw = weight ?? (v.weight as Weight);
  return (
    <RNText
      testID={testID}
      numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts[lang][fw], fontSize: fs, color, lineHeight: Math.round(fs * (lang === 'km' ? 1.7 : 1.4)) }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </RNText>
  );
}

/* ------------------------------------------------------------------ layout */

export function HeaderButton({ icon: Icon, onPress, label, badge, testID, light }: {
  icon: LucideIcon; onPress: () => void; label: string; badge?: number; testID?: string; light?: boolean;
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.headerBtn, light && { backgroundColor: 'rgba(255,255,255,0.12)' }, pressed && { opacity: 0.7 }]}>
      <Icon size={20} color={light ? colors.white : colors.ink} strokeWidth={2} />
      {!!badge && badge > 0 && (
        <View testID={testID ? `${testID}-badge` : undefined} style={styles.badgeDot}>
          <T size={10} weight="bold" color={colors.white}>{badge > 9 ? '9+' : String(badge)}</T>
        </View>
      )}
    </Pressable>
  );
}

/** Notification bell for root screens (shown only inside the signed-in tab app). */
export function BellButton({ light }: { light?: boolean }) {
  const notif = useNotifications();
  const nav = useNav();
  if (!notif) return null;
  return (
    <HeaderButton testID="bell" icon={Bell} light={light} label={`Notifications, ${notif.unread} unread`} badge={notif.unread}
      onPress={() => nav.push('Notifications')} />
  );
}

export function Screen({ title, subtitle, children, scroll = true, back = true, right, footer, header = true, padded = true }: {
  title?: string; subtitle?: string; children: ReactNode; scroll?: boolean; back?: boolean; right?: ReactNode; footer?: ReactNode;
  header?: boolean; padded?: boolean;
}) {
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const canBack = back && nav.stack.length > 1;
  const isRoot = nav.stack.length === 1;
  const bodyStyle = [padded && styles.screenBody];
  const body = scroll
    ? <ScrollView contentContainerStyle={bodyStyle} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    : <View style={[bodyStyle, { flex: 1 }]}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {header && title !== undefined && (
        <View style={[styles.header, { paddingTop: insets.top + space(2) }]}>
          {canBack && <HeaderButton icon={ChevronLeft} label="Back" onPress={nav.pop} />}
          <View style={{ flex: 1, paddingLeft: canBack ? 0 : space(1) }}>
            <T variant={isRoot ? 'title' : 'h3'} weight="bold" numberOfLines={1}>{title}</T>
            {subtitle ? <T variant="caption" color={colors.ink3} numberOfLines={1}>{subtitle}</T> : null}
          </View>
          {right}
          {isRoot && <BellButton />}
        </View>
      )}
      {body}
      {footer && <View style={[styles.footer, { paddingBottom: insets.bottom + space(3) }]}>{footer}</View>}
    </View>
  );
}

export function Card({ children, style, onPress, testID, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string; padded?: boolean }) {
  const base = [styles.card, !padded && { padding: 0 }];
  if (onPress) {
    return (
      <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={[base, style]}>{children}</View>;
}

export function Row({ children, style, gap = 3 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space(gap) }, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space(6), marginBottom: space(3) }}>
      <T variant="h3" weight="bold" style={{ flex: 1 }}>{children}</T>
      {right}
    </Row>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: 1, backgroundColor: colors.lineSoft, marginVertical: space(3), marginLeft: inset }} />;
}

/* ------------------------------------------------------------------ controls */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'accent' | 'subtle';

export function Button({ label, onPress, variant = 'primary', disabled, loading, icon: Icon, small, testID, full = true }: {
  label: string; onPress?: () => void | Promise<void>; variant?: ButtonVariant;
  disabled?: boolean; loading?: boolean; icon?: LucideIcon; small?: boolean; testID?: string; full?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const isBusy = loading || busy;
  const p = {
    primary: { bg: colors.brand, fg: colors.white, border: colors.brand },
    secondary: { bg: colors.deep, fg: colors.white, border: colors.deep },
    accent: { bg: colors.accent, fg: colors.white, border: colors.accent },
    outline: { bg: colors.surface, fg: colors.ink, border: colors.line },
    danger: { bg: colors.surface, fg: colors.danger, border: '#F5C2C2' },
    ghost: { bg: 'transparent', fg: colors.brand, border: 'transparent' },
    subtle: { bg: colors.brandSoft, fg: colors.brandPressed, border: colors.brandSoft },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || isBusy, busy: isBusy }}
      disabled={disabled || isBusy}
      onPress={async () => {
        if (!onPress) return;
        setBusy(true);
        try { await onPress(); } finally { setBusy(false); }
      }}
      style={({ pressed }) => [
        styles.button, small && styles.buttonSmall, !full && { alignSelf: 'flex-start' },
        { backgroundColor: p.bg, borderColor: p.border },
        (disabled || isBusy) && { opacity: 0.45 }, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
    >
      {isBusy ? <ActivityIndicator color={p.fg} /> : (
        <Row gap={2}>
          {Icon && <Icon size={small ? 16 : 18} color={p.fg} strokeWidth={2.2} />}
          <T weight="semibold" size={small ? 14 : 15} color={p.fg}>{label}</T>
        </Row>
      )}
    </Pressable>
  );
}

export function Field({ label, hint, icon: Icon, ...props }: TextInputProps & { label: string; hint?: string; icon?: LucideIcon }) {
  const { lang } = useI18n();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: space(4) }}>
      {label ? <T variant="label" weight="semibold" color={colors.ink2} style={{ marginBottom: space(1.5) }}>{label}</T> : null}
      <View style={[styles.inputWrap, focused && styles.inputFocused, props.multiline && { alignItems: 'flex-start' }]}>
        {Icon && <View style={{ paddingTop: props.multiline ? space(3.5) : 0 }}><Icon size={18} color={colors.ink3} /></View>}
        <TextInput
          placeholderTextColor={colors.ink4}
          {...props}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[styles.input, { fontFamily: fonts[lang].regular }, props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: space(3) }, props.style]}
        />
      </View>
      {hint && <T variant="caption" color={colors.ink3} style={{ marginTop: space(1.5) }}>{hint}</T>}
    </View>
  );
}

export function Chip({ label, selected, onPress, disabled, testID, selectedColor = colors.brand, icon: Icon }: {
  label: string; selected?: boolean; onPress?: () => void; disabled?: boolean; testID?: string; selectedColor?: string; icon?: LucideIcon;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && { backgroundColor: selectedColor, borderColor: selectedColor }, disabled && { opacity: 0.4 }, pressed && styles.pressed]}
    >
      <Row gap={1.5}>
        {Icon && <Icon size={15} color={selected ? colors.white : colors.ink3} />}
        <T size={14} weight={selected ? 'semibold' : 'medium'} color={selected ? colors.white : colors.ink2}>{label}</T>
      </Row>
    </Pressable>
  );
}

/** Two-to-four option segmented control. */
export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: Array<[V, string]>; onChange: (v: V) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable key={v} testID={`seg-${v}`} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(v)}
            style={[styles.segment, on && styles.segmentOn]}>
            <T size={14} weight={on ? 'semibold' : 'medium'} color={on ? colors.ink : colors.ink3} center>{l}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ display */

export function Badge({ label, tone = 'neutral', dot }: { label: string; tone?: Tone; dot?: boolean }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.dot }} />}
      <T size={12} weight="semibold" color={c.fg}>{label}</T>
    </View>
  );
}

/** Status pill: dot + text, never color alone. */
export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return <Badge dot label={t(`status.${status}` as TranslationKey)} tone={statusTone(status)} />;
}

export function DemoBadge({ text }: { text?: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.demo}>
      <T size={11} weight="bold" color="#9A3412">{text ?? t('common.demo')}</T>
    </View>
  );
}

export function IconTile({ icon: Icon, tone = 'info', size = 44 }: { icon: LucideIcon; tone?: Tone | 'deep' | 'violet'; size?: number }) {
  const c = tone === 'deep' ? { bg: colors.deep, fg: colors.white } : tone === 'violet' ? { bg: colors.violetSoft, fg: colors.violet } : { bg: toneColors[tone].bg, fg: toneColors[tone].fg };
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.48} color={c.fg} strokeWidth={2} />
    </View>
  );
}

export function Avatar({ name, uri, size = 48 }: { name: string; uri?: string | null; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.line }} />;
  const initials = name.replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
      <T weight="bold" size={size / 2.7} color={colors.brandPressed}>{initials || '?'}</T>
    </View>
  );
}

export function Stars({ value, size = 14, count }: { value: number | null; size?: number; count?: number }) {
  if (value === null) return null;
  return (
    <Row gap={1}>
      <Star size={size} color="#F59E0B" fill="#F59E0B" />
      <T size={size} weight="semibold" color={colors.ink}>{value.toFixed(1)}</T>
      {count !== undefined && <T size={size - 1} color={colors.ink3}>({count})</T>}
    </Row>
  );
}

/** Tappable row: icon tile, title, subtitle, optional right content and chevron. */
export function ListItem({ icon, iconTone, leading, title, subtitle, right, onPress, testID, chevron = true }: {
  icon?: LucideIcon; iconTone?: Tone | 'deep' | 'violet'; leading?: ReactNode; title: string; subtitle?: string; right?: ReactNode;
  onPress?: () => void; testID?: string; chevron?: boolean;
}) {
  const content = (
    <Row gap={3}>
      {icon ? <IconTile icon={icon} tone={iconTone} size={40} /> : leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T weight="semibold" numberOfLines={1}>{title}</T>
        {subtitle ? <T variant="small" color={colors.ink3} numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {right}
      {onPress && chevron && <ChevronRight size={18} color={colors.ink4} />}
    </Row>
  );
  if (!onPress) return <View testID={testID} style={styles.listItem}>{content}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.listItem, pressed && { backgroundColor: colors.lineSoft }]}>
      {content}
    </Pressable>
  );
}

export function KeyValue({ label, value, icon: Icon }: { label: string; value: ReactNode; icon?: LucideIcon }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: space(2), gap: space(3) }}>
      <Row gap={2} style={{ flexShrink: 0 }}>
        {Icon && <Icon size={16} color={colors.ink4} />}
        <T variant="small" color={colors.ink3}>{label}</T>
      </Row>
      {typeof value === 'string' ? <T variant="small" weight="semibold" style={{ flexShrink: 1, textAlign: 'right' }}>{value}</T> : value}
    </View>
  );
}

export function Banner({ text, tone = 'info', icon }: { text: string; tone?: Tone; icon?: LucideIcon }) {
  const c = toneColors[tone];
  const Icon = icon ?? (tone === 'danger' ? CircleAlert : tone === 'warning' || tone === 'accent' ? TriangleAlert : tone === 'success' ? CircleCheck : Info);
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }]} accessibilityRole={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={18} color={c.fg} />
      <T variant="small" weight="medium" color={c.fg} style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

/* ------------------------------------------------------------------ states */

export function Loading() {
  const { t } = useI18n();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand} />
      <T color={colors.ink3} style={{ marginTop: space(3) }}>{t('common.loading')}</T>
    </View>
  );
}

export function errorText(e: unknown, t: ReturnType<typeof useI18n>['t']) {
  if (e instanceof ApiError) {
    if (e.code === 'NETWORK') return t('common.offline');
    const key = `err.${e.code}` as TranslationKey;
    const translated = t(key);
    return translated !== key ? translated : e.message;
  }
  return e instanceof Error ? e.message : t('common.error');
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.center}>
      <IconTile icon={CircleAlert} tone="danger" size={56} />
      <T weight="semibold" center style={{ marginVertical: space(4), maxWidth: 300 }}>{errorText(error, t)}</T>
      {onRetry && <Button full={false} label={t('common.retry')} onPress={onRetry} variant="outline" small />}
    </View>
  );
}

export function Empty({ text, icon = Inbox, action }: { text: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <View style={[styles.center, { paddingVertical: space(10) }]}>
      <IconTile icon={icon} tone="neutral" size={56} />
      <T color={colors.ink3} center style={{ marginTop: space(3), maxWidth: 280 }}>{text}</T>
      {action && <View style={{ marginTop: space(4) }}>{action}</View>}
    </View>
  );
}

/* ------------------------------------------------------------------ signature pieces */

export function formatCountdown(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Circular countdown for the server-enforced 5-minute response window (display only). */
export function CountdownRing({ msLeft, totalMs = 300_000, size = 76, testID }: { msLeft: number; totalMs?: number; size?: number; testID?: string }) {
  const stroke = Math.max(5, size / 11);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, msLeft / totalMs));
  const urgent = msLeft < 60_000;
  const tone = urgent ? colors.danger : colors.accent;
  return (
    <View testID={testID} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="timer" accessibilityLabel={`${formatCountdown(msLeft)} left`}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.lineSoft} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={tone} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" />
      </Svg>
      <T weight="bold" size={size / 4.3} color={tone}>{formatCountdown(msLeft)}</T>
    </View>
  );
}

export function CountdownBar({ msLeft, totalMs = 300_000 }: { msLeft: number; totalMs?: number }) {
  const pct = Math.max(0, Math.min(1, msLeft / totalMs));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: msLeft < 60_000 ? colors.danger : colors.accent }]} />
    </View>
  );
}

/** FixNow progress track: five segments Requested → Accepted → In progress → Finished → Paid. */
export function ProgressTrack({ status, labels = false }: { status: string; labels?: boolean }) {
  const { t } = useI18n();
  const idx = jobStepIndex(status);
  const stopped = idx < 0;
  return (
    <View accessibilityLabel={t(`status.${status}` as TranslationKey)}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {JOB_STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: !stopped && i <= idx ? colors.brand : colors.line }} />
        ))}
      </View>
      {labels && (
        <View style={{ flexDirection: 'row', marginTop: space(2) }}>
          {JOB_STEPS.map((s, i) => (
            <T key={s} size={10} weight={i === idx ? 'bold' : 'medium'} color={i <= idx && !stopped ? colors.ink2 : colors.ink4} style={{ flex: 1 }} numberOfLines={2}>
              {t(`status.${s}` as TranslationKey)}
            </T>
          ))}
        </View>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  screenBody: { padding: space(4), paddingBottom: space(12) },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingBottom: space(3),
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.lineSoft,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  badgeDot: {
    position: 'absolute', top: 3, right: 1, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white,
  },
  footer: { padding: space(4), backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space(4), marginBottom: space(3),
    borderWidth: 1, borderColor: colors.line, ...shadow.card,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  button: {
    minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: space(5), borderWidth: 1,
  },
  buttonSmall: { minHeight: 42, paddingHorizontal: space(3.5), borderRadius: radius.sm },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space(2), minHeight: 52, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, paddingHorizontal: space(3.5), backgroundColor: colors.surface,
  },
  inputFocused: { borderColor: colors.brand, borderWidth: 1.5 },
  input: { flex: 1, minHeight: 50, paddingVertical: space(2.5), fontSize: 16, color: colors.ink, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
  chip: {
    minHeight: 40, paddingHorizontal: space(3.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  segmented: { flexDirection: 'row', backgroundColor: '#EBEEF3', borderRadius: radius.md, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(2) },
  segmentOn: { backgroundColor: colors.surface, ...shadow.card },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill, alignSelf: 'flex-start' },
  demo: { backgroundColor: '#FFE3CC', paddingHorizontal: space(2), paddingVertical: 2, borderRadius: radius.xs, alignSelf: 'flex-start' },
  listItem: { paddingVertical: space(3), paddingHorizontal: space(4), backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(6) },
  banner: { flexDirection: 'row', gap: space(2.5), alignItems: 'flex-start', padding: space(3.5), borderRadius: radius.md, marginBottom: space(3) },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.lineSoft, overflow: 'hidden', marginTop: space(2) },
  progressFill: { height: 6, borderRadius: 3 },
});
