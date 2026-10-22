import { ChevronLeft, Clock3, House, KeyRound, LogIn, Phone, QrCode, Search, ShieldCheck, Sparkles, UserPlus, UserRound, Wrench } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { areaLabel } from '@fixnow/shared';
import { ApiError, api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useApi } from '../../lib/useApi';
import { Avatar, Badge, Banner, Button, Card, DemoBadge, Field, IconTile, ListItem, Row, Segmented, T, errorText } from '../../ui';
import { HeroIllustration } from '../../ui/HeroIllustration';
import { colors, radius, space } from '../../ui/theme';

interface DemoAccount {
  phone: string; name: string; role: 'CUSTOMER' | 'TECHNICIAN'; technicianStatus: string | null; featured: boolean;
  area: string | null; categories: string[]; rating: number | null; activeBookings: number;
}
const CATEGORY_LABEL: Record<string, TranslationKey> = { AC: 'demo.cat.AC', ELECTRICAL: 'demo.cat.ELECTRICAL', PLUMBING: 'demo.cat.PLUMBING', APPLIANCES: 'demo.cat.APPLIANCES' };

type Page = 'start' | 'login' | 'register' | 'demo';
/** Phone and code carried over when Log in finds a new number and sends the user to Create account. */
interface Carry { phone: string; code: string; demoCode: string | null }

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

function RoleCard({ selected, onPress, icon: Icon, label, testID }: { selected: boolean; onPress: () => void; icon: typeof House; label: string; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress}
      style={{
        flex: 1, padding: space(3.5), borderRadius: radius.md, borderWidth: 1.5, gap: space(2),
        borderColor: selected ? colors.brand : colors.line, backgroundColor: selected ? colors.brandSoft : colors.surface,
      }}>
      <Icon size={22} color={selected ? colors.brand : colors.ink3} />
      <T variant="small" weight="semibold" color={selected ? colors.brandPressed : colors.ink2}>{label}</T>
    </Pressable>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable testID="auth-back" accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onPress} hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space(1), marginBottom: space(4), marginLeft: -space(1) }}>
      <ChevronLeft size={20} color={colors.brand} />
      <T variant="small" weight="semibold" color={colors.brand}>{t('common.back')}</T>
    </Pressable>
  );
}

function PageTitle({ title, note, badge }: { title: string; note: string; badge?: boolean }) {
  return (
    <>
      <Row style={{ justifyContent: 'space-between', marginBottom: space(1) }}>
        <T variant="title">{title}</T>
        {badge && <DemoBadge />}
      </Row>
      <T variant="small" color={colors.ink3} style={{ marginBottom: space(4) }}>{note}</T>
    </>
  );
}

/** Landing page: real sign-in, sign-up, and a single entry point to the demo accounts. */
function Start({ go }: { go: (p: Page) => void }) {
  const { t } = useI18n();
  return (
    <>
      <PageTitle title={t('welcome.getStarted')} note={t('welcome.startNote')} />
      <View style={{ gap: space(3) }}>
        <Button icon={LogIn} label={t('auth.login')} onPress={() => go('login')} testID="open-login" />
        <Button icon={UserPlus} variant="outline" label={t('auth.register')} onPress={() => go('register')} testID="open-register" />
      </View>
      <Row gap={3} style={{ marginTop: space(6), marginBottom: space(3) }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        <T variant="caption" color={colors.ink3}>{t('welcome.orDemo')}</T>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </Row>
      <Card padded={false} style={{ overflow: 'hidden', borderStyle: 'dashed', borderColor: colors.brandLine }}>
        <ListItem testID="open-demo" onPress={() => go('demo')}
          leading={<IconTile icon={Sparkles} tone="violet" size={40} />}
          title={t('welcome.tryDemo')} subtitle={t('welcome.tryDemoNote')} right={<DemoBadge />} />
      </Card>
    </>
  );
}

function LangToggle() {
  const { t, lang, setLang } = useI18n();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.pill, padding: 3 }}>
      {(['en', 'km'] as const).map((l) => (
        <Pressable key={l} testID={`lang-${l}`} accessibilityRole="button" accessibilityState={{ selected: lang === l }} onPress={() => setLang(l)}
          style={{ paddingHorizontal: space(3.5), height: 32, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: lang === l ? colors.white : 'transparent' }}>
          <T size={13} weight="semibold" color={lang === l ? colors.deep : '#C7D2FE'}>{t(`lang.${l}`)}</T>
        </Pressable>
      ))}
    </View>
  );
}

function Wordmark({ size }: { size: number }) {
  return <T size={size} weight="bold" color={colors.white}>Fix<T size={size} weight="bold" color={colors.accent}>Now</T></T>;
}

/** Start page header: illustration, headline and the three promises customers care about most. */
function HeroHeader() {
  const { t } = useI18n();
  const props: Array<[typeof ShieldCheck, TranslationKey]> = [
    [ShieldCheck, 'welcome.prop.verified'], [Clock3, 'welcome.prop.fast'], [QrCode, 'welcome.prop.payAfter'],
  ];
  return (
    <>
      <View style={{ marginTop: space(3), marginBottom: space(5), paddingHorizontal: space(2) }}>
        <HeroIllustration />
      </View>
      <T size={26} weight="bold" color={colors.white} style={{ lineHeight: 33 }}>{t('welcome.heroTitle')}</T>
      <T variant="body" color="#C7D2FE" style={{ marginTop: space(2) }}>{t('app.tagline')}</T>
      <Row gap={2} style={{ marginTop: space(4), alignItems: 'stretch' }}>
        {props.map(([Icon, key]) => (
          <View key={key} style={{ flex: 1, alignItems: 'center', gap: space(1), paddingVertical: space(2), paddingHorizontal: space(1),
            borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Icon size={18} color="#93C5FD" />
            <T size={11} weight="semibold" color="#E0E7FF" center>{t(key)}</T>
          </View>
        ))}
      </Row>
    </>
  );
}

/** Phone + one-time code. Log in only accepts existing numbers; Create account also asks for a name and role. */
function PhoneAuth({ mode, initial, onNewNumber }: { mode: 'login' | 'register'; initial?: Carry; onNewNumber: (c: Carry) => void }) {
  const { t } = useI18n();
  const { signInWithToken } = useAuth();
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [demoCode, setDemoCode] = useState<string | null>(initial?.demoCode ?? null);
  const [role, setRole] = useState<'CUSTOMER' | 'TECHNICIAN'>('CUSTOMER');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const register = mode === 'register';

  const requestCode = async () => {
    setError(null);
    try {
      const r = await api<{ demoCode?: string }>('/auth/otp/request', { method: 'POST', body: { phone } });
      setDemoCode(r.demoCode ?? null);
      setCode('');
    } catch (e) { setError(errorText(e, t)); }
  };

  const verify = async () => {
    setError(null);
    try {
      const r = await api<{ token: string }>('/auth/otp/verify', {
        method: 'POST', body: { phone, code, ...(register ? { role, name: name.trim() } : {}) },
      });
      await signInWithToken(r.token);
    } catch (e) {
      // The code is not consumed when the number is new, so it can be reused on the Create account page.
      if (e instanceof ApiError && e.details?.needsRole) { onNewNumber({ phone, code, demoCode }); return; }
      setError(errorText(e, t));
    }
  };

  const codeSent = demoCode !== null;
  return (
    <>
      <PageTitle title={t(register ? 'auth.register' : 'auth.login')} note={t(register ? 'auth.registerNote' : 'auth.loginNote')} />
      {error && <Banner text={error} tone="danger" />}
      {register && initial && <Banner tone="info" text={t('auth.noAccountYet')} />}
      <Card>
        {register && (
          <>
            <T variant="label" weight="semibold" color={colors.ink2} style={{ marginBottom: space(2) }}>{t('auth.iAm')}</T>
            <Row gap={3} style={{ marginBottom: space(4) }}>
              <RoleCard testID="role-CUSTOMER" selected={role === 'CUSTOMER'} onPress={() => setRole('CUSTOMER')} icon={House} label={t('auth.asCustomer')} />
              <RoleCard testID="role-TECHNICIAN" selected={role === 'TECHNICIAN'} onPress={() => setRole('TECHNICIAN')} icon={Wrench} label={t('auth.asTechnician')} />
            </Row>
            <Field icon={UserRound} label={t('auth.yourName')} value={name} onChangeText={setName} testID="register-name" />
          </>
        )}
        <Field icon={Phone} label={t('auth.phone')} placeholder={t('auth.phonePlaceholder')} keyboardType="phone-pad" value={phone}
          onChangeText={(v) => { setPhone(v); if (codeSent) { setDemoCode(null); setCode(''); } }} testID="phone-input" hint="+855" />
        {!codeSent ? (
          <Button label={t('auth.sendCode')} onPress={requestCode} disabled={phone.replace(/\D/g, '').length < 8 || (register && !name.trim())} testID="send-code" />
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
            {register && <T variant="caption" color={colors.ink3} style={{ marginBottom: space(3) }}>{t('auth.oneRole')}</T>}
            <Button label={t(register ? 'auth.createAccount' : 'auth.login')} onPress={verify}
              disabled={code.length !== 6 || (register && !name.trim())} testID="verify-code" />
            <View style={{ marginTop: space(2) }}>
              <Button variant="ghost" small label={t('auth.resendCode')} onPress={requestCode} testID="resend-code" />
            </View>
          </>
        )}
      </Card>
    </>
  );
}

/** DEMO sign-in for competition judges: pick any seeded customer or technician. */
function DemoAccounts() {
  const { t, lang } = useI18n();
  const { signInWithToken } = useAuth();
  const demo = useApi<{ items: DemoAccount[] }>('/auth/demo-accounts');
  const [group, setGroup] = useState<'CUSTOMER' | 'TECHNICIAN'>('CUSTOMER');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const demoLogin = async (p: string) => {
    setError(null);
    try {
      const r = await api<{ token: string }>('/auth/demo-login', { method: 'POST', body: { phone: p } });
      await signInWithToken(r.token);
    } catch (e) { setError(errorText(e, t)); }
  };

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
    <>
      {error && <Banner text={error} tone="danger" />}
      <PageTitle title={t('welcome.demoAccounts')} note={t('welcome.demoNote')} badge />
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
    </>
  );
}

export function Welcome() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>('start');
  const [carry, setCarry] = useState<Carry | undefined>();
  const go = (p: Page) => { setCarry(undefined); setPage(p); };

  // Android back button returns to the start page instead of closing the app.
  useEffect(() => {
    if (page === 'start') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { go('start'); return true; });
    return () => sub.remove();
  }, [page]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.deep }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      {/* Brand header: full illustrated hero on the start page, compact on the forms so they get the room */}
      <View style={{ paddingTop: insets.top + space(page === 'start' ? 6 : 5), paddingHorizontal: space(5), paddingBottom: space(8) }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={3}>
            <BrandMark size={40} />
            <Wordmark size={22} />
          </Row>
          <LangToggle />
        </Row>
        {page === 'start' ? <HeroHeader /> : (
          <Row gap={2} style={{ marginTop: space(4) }}>
            <ShieldCheck size={16} color="#86EFAC" />
            <T variant="small" color="#E0E7FF">{t('app.tagline')}</T>
          </Row>
        )}
      </View>

      {/* Sheet */}
      <View style={{ flex: 1, backgroundColor: colors.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space(5), paddingBottom: insets.bottom + space(10) }}>
        {page !== 'start' && <BackLink onPress={() => go('start')} />}
        {page === 'start' && <Start go={go} />}
        {page === 'login' && <PhoneAuth key="login" mode="login" onNewNumber={(c) => { setCarry(c); setPage('register'); }} />}
        {page === 'register' && <PhoneAuth key="register" mode="register" initial={carry} onNewNumber={() => {}} />}
        {page === 'demo' && <DemoAccounts />}
      </View>
    </ScrollView>
  );
}
