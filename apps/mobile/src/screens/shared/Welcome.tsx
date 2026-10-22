import { House, KeyRound, Phone, Search, ShieldCheck, Wrench } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { areaLabel } from '@fixnow/shared';
import { ApiError, api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { Avatar, Badge, Banner, Button, Card, DemoBadge, Field, ListItem, Row, Segmented, T, errorText } from '../../ui';
import { colors, radius, space } from '../../ui/theme';

interface DemoAccount {
  phone: string; name: string; role: 'CUSTOMER' | 'TECHNICIAN'; technicianStatus: string | null; featured: boolean;
  area: string | null; categories: string[]; rating: number | null; activeBookings: number;
}
const CATEGORY_LABEL: Record<string, TranslationKey> = { AC: 'demo.cat.AC', ELECTRICAL: 'demo.cat.ELECTRICAL', PLUMBING: 'demo.cat.PLUMBING', APPLIANCES: 'demo.cat.APPLIANCES' };

/** FixNow mark: house tile with the orange wrench badge. */
export function BrandMark({ size = 52 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
      <House size={size * 0.5} color={colors.white} strokeWidth={2.2} />
      <View style={{
        position: 'absolute', right: -size * 0.1, bottom: -size * 0.1, width: size * 0.46, height: size * 0.46, borderRadius: size * 0.23,
        backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.deep,
      }}>
        <Wrench size={size * 0.24} color={colors.white} strokeWidth={2.4} />
      </View>
    </View>
  );
}

function RoleCard({ selected, onPress, icon: Icon, label }: { selected: boolean; onPress: () => void; icon: typeof House; label: string }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress}
      style={{
        flex: 1, padding: space(3.5), borderRadius: radius.md, borderWidth: 1.5, gap: space(2),
        borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.brandSoft : colors.surface,
      }}>
      <Icon size={22} color={selected ? colors.brand : colors.ink3} />
      <T variant="small" weight="semibold" color={selected ? colors.brandPressed : colors.ink2}>{label}</T>
    </Pressable>
  );
}

export function Welcome() {
  const { t, lang, setLang } = useI18n();
  const { signInWithToken } = useAuth();
  const insets = useSafeAreaInsets();
  const demo = useApi<{ items: DemoAccount[] }>('/auth/demo-accounts');
  const [group, setGroup] = useState<'CUSTOMER' | 'TECHNICIAN'>('CUSTOMER');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [needsRole, setNeedsRole] = useState(false);
  const [role, setRole] = useState<'CUSTOMER' | 'TECHNICIAN'>('CUSTOMER');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const demoLogin = async (p: string) => {
    setError(null);
    try {
      const r = await api<{ token: string }>('/auth/demo-login', { method: 'POST', body: { phone: p } });
      await signInWithToken(r.token);
    } catch (e) { setError(errorText(e, t)); }
  };

  const requestCode = async () => {
    setError(null);
    try {
      const r = await api<{ demoCode?: string }>('/auth/otp/request', { method: 'POST', body: { phone } });
      setDemoCode(r.demoCode ?? null);
    } catch (e) { setError(errorText(e, t)); }
  };

  const verify = async () => {
    setError(null);
    try {
      const r = await api<{ token: string }>('/auth/otp/verify', {
        method: 'POST', body: { phone, code, ...(needsRole ? { role, name: name || undefined } : {}) },
      });
      await signInWithToken(r.token);
    } catch (e) {
      if (e instanceof ApiError && e.details?.needsRole) { setNeedsRole(true); return; }
      setError(errorText(e, t));
    }
  };

  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const accounts = (demo.data?.items ?? []).filter((a) => a.role === group && (!term || a.name.toLowerCase().includes(term)));
  const sections: Array<[string, DemoAccount[]]> = term
    ? [['', accounts]]
    : [[t('demo.featured'), accounts.filter((a) => a.featured)], [t('demo.everyone'), accounts.filter((a) => !a.featured)]];
  // What a presenter needs to tell people apart: specialty, area, rating (technicians) or area and open bookings (customers).
  const describe = (a: DemoAccount) => {
    const parts: string[] = [];
    if (a.role === 'TECHNICIAN' && a.categories.length) parts.push(a.categories.map((c) => t(CATEGORY_LABEL[c] ?? 'demo.cat.AC')).join(' + '));
    if (a.area) parts.push(areaLabel(a.area, lang));
    if (a.role === 'TECHNICIAN' && a.rating !== null) parts.push(`★ ${a.rating.toFixed(1)}`);
    if (a.activeBookings > 0) parts.push(t('demo.active', { n: a.activeBookings }));
    return parts.join(' · ');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.deep }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      {/* Brand header */}
      <View style={{ paddingTop: insets.top + space(8), paddingHorizontal: space(5), paddingBottom: space(10) }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <BrandMark />
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.pill, padding: 3 }}>
            {(['en', 'km'] as const).map((l) => (
              <Pressable key={l} testID={`lang-${l}`} accessibilityRole="button" accessibilityState={{ selected: lang === l }} onPress={() => setLang(l)}
                style={{ paddingHorizontal: space(3.5), height: 32, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: lang === l ? colors.white : 'transparent' }}>
                <T size={13} weight="semibold" color={lang === l ? colors.deep : '#C7D2FE'}>{t(`lang.${l}`)}</T>
              </Pressable>
            ))}
          </View>
        </Row>
        <T size={32} weight="bold" color={colors.white} style={{ marginTop: space(6) }}>
          Fix<T size={32} weight="bold" color={colors.accent}>Now</T>
        </T>
        <T variant="body" color="#C7D2FE" style={{ marginTop: space(1) }}>{t('app.tagline')}</T>
        <Row gap={2} style={{ marginTop: space(4) }}>
          <ShieldCheck size={16} color="#86EFAC" />
          <T variant="small" color="#E0E7FF">{t('tech.verified')}</T>
        </Row>
      </View>

      {/* Sheet */}
      <View style={{ flex: 1, backgroundColor: colors.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space(5), paddingBottom: insets.bottom + space(10) }}>
        {error && <Banner text={error} tone="danger" />}
        <Row style={{ justifyContent: 'space-between', marginBottom: space(1) }}>
          <T variant="title">{t('welcome.demoAccounts')}</T>
          <DemoBadge />
        </Row>
        <T variant="small" color={colors.ink3} style={{ marginBottom: space(4) }}>{t('welcome.demoNote')}</T>
        <Segmented value={group} onChange={setGroup} options={[['CUSTOMER', t('welcome.customers')], ['TECHNICIAN', t('welcome.technicians')]]} />
        <View style={{ marginTop: space(3) }}>
          <Field icon={Search} label="" placeholder={t('demo.search')} value={search} onChangeText={setSearch} testID="demo-search" />
        </View>
        {demo.error && <Banner text={errorText(demo.error, t)} tone="danger" />}
        {demo.data && accounts.length === 0 && <T color={colors.ink3} center style={{ marginVertical: space(4) }}>{t('demo.none')}</T>}
        {sections.filter(([, items]) => items.length > 0).map(([title, items]) => (
          <View key={title || 'results'} style={{ marginBottom: space(3) }}>
            {title ? <T variant="caption" weight="bold" color={colors.ink3} style={{ marginBottom: space(2), textTransform: 'uppercase', letterSpacing: 0.5 }}>{title} · {items.length}</T> : null}
            <Card padded={false} style={{ overflow: 'hidden', marginBottom: 0 }}>
              {items.map((a, i) => (
                <View key={a.phone} style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.lineSoft } : undefined}>
                  <ListItem
                    testID={`demo-${a.phone}`} onPress={() => demoLogin(a.phone)}
                    leading={<Avatar name={a.name} size={40} />}
                    title={a.name} subtitle={describe(a)}
                    right={a.technicianStatus && a.technicianStatus !== 'APPROVED'
                      ? <Badge dot label={t(`techstatus.${a.technicianStatus}` as never)} tone={a.technicianStatus === 'PENDING' ? 'warning' : 'danger'} />
                      : undefined}
                  />
                </View>
              ))}
            </Card>
          </View>
        ))}

        <Row gap={3} style={{ marginTop: space(6), marginBottom: space(4) }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          <T variant="caption" color={colors.ink3}>{t('welcome.orPhone')}</T>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        </Row>

        <Card>
          <Field icon={Phone} label={t('auth.phone')} placeholder={t('auth.phonePlaceholder')} keyboardType="phone-pad" value={phone}
            onChangeText={setPhone} testID="phone-input" hint="+855" />
          {demoCode === null ? (
            <Button label={t('auth.sendCode')} onPress={requestCode} disabled={phone.replace(/\D/g, '').length < 8} testID="send-code" />
          ) : (
            <>
              <Banner tone="accent" icon={KeyRound} text={t('auth.demoCode', { code: demoCode })} />
              <View style={{ marginTop: -space(1), marginBottom: space(3) }}>
                <Button testID="use-demo-code" small full={false} variant="subtle" label={t('auth.useCode')} onPress={() => setCode(demoCode)} />
              </View>
              {/* No hard maxLength: some Android keyboards drop the last digit with it, and pasted codes may contain spaces.
                  Keep digits only and trim to 6 instead. */}
              <Field icon={KeyRound} label={t('auth.code')} keyboardType="number-pad" inputMode="numeric" autoComplete="sms-otp" textContentType="oneTimeCode"
                value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} testID="code-input" />
              {needsRole && (
                <View style={{ marginBottom: space(4) }}>
                  <T variant="label" weight="semibold" style={{ marginBottom: space(2) }}>{t('auth.newAccount')}</T>
                  <Row gap={3} style={{ marginBottom: space(4) }}>
                    <RoleCard selected={role === 'CUSTOMER'} onPress={() => setRole('CUSTOMER')} icon={House} label={t('auth.asCustomer')} />
                    <RoleCard selected={role === 'TECHNICIAN'} onPress={() => setRole('TECHNICIAN')} icon={Wrench} label={t('auth.asTechnician')} />
                  </Row>
                  <Field label={t('auth.yourName')} value={name} onChangeText={setName} />
                  <T variant="caption" color={colors.ink3}>{t('auth.oneRole')}</T>
                </View>
              )}
              <Button label={t('auth.verify')} onPress={verify} disabled={code.length !== 6} testID="verify-code" />
            </>
          )}
        </Card>
      </View>
    </ScrollView>
  );
}
