import { Languages, LifeBuoy, LogOut, MapPin, Phone, Save, User } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SERVICE_AREAS, findArea, type Me } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { api, fileUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useNav } from '../../lib/nav';
import { Avatar, Banner, BellButton, Button, Card, DemoBadge, Field, IconTile, ListItem, Row, SectionTitle, T, errorText } from '../../ui';
import { AreaPicker } from '../../ui/AreaPicker';
import { colors, radius, space } from '../../ui/theme';
import { ScrollView } from 'react-native';

/** Language switch that also saves the preference on the server. */
export function LanguageSwitch() {
  const { t, lang, setLang } = useI18n();
  const { setMe } = useAuth();
  const choose = async (l: 'en' | 'km') => {
    setLang(l);
    try { setMe(await api<Me>('/me', { method: 'PATCH', body: { preferredLanguage: l } })); } catch { /* local switch still applies */ }
  };
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#EBEEF3', borderRadius: radius.md, padding: 4, gap: 4 }}>
      {(['en', 'km'] as const).map((l) => (
        <Pressable key={l} testID={`profile-lang-${l}`} accessibilityRole="button" accessibilityState={{ selected: lang === l }} onPress={() => choose(l)}
          style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: lang === l ? colors.surface : 'transparent' }}>
          <T size={14} weight={lang === l ? 'semibold' : 'medium'} color={lang === l ? colors.ink : colors.ink3}>{t(`lang.${l}`)}</T>
        </Pressable>
      ))}
    </View>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <Card padded={false} style={{ overflow: 'hidden' }}>{children}</Card>;
}
function Sep() { return <View style={{ height: 1, backgroundColor: colors.lineSoft, marginLeft: space(16) }} />; }

export function ProfileShell({ children, photoUrl, subtitle }: { children?: ReactNode; photoUrl?: string | null; subtitle?: ReactNode }) {
  const { t } = useI18n();
  const { me, signOut } = useAuth();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  if (!me) return null;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ paddingBottom: space(12) }} showsVerticalScrollIndicator={false}>
      <View style={{ backgroundColor: colors.deep, paddingTop: insets.top + space(3), paddingHorizontal: space(5), paddingBottom: space(8), borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="title" color={colors.white}>{t('profile.title')}</T>
          <BellButton light />
        </Row>
        <Row gap={4} style={{ marginTop: space(5) }}>
          <View style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 40 }}>
            <Avatar name={me.name ?? '?'} uri={fileUrl(photoUrl)} size={68} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="title" color={colors.white} numberOfLines={1}>{me.name ?? '—'}</T>
            <Row gap={1.5} style={{ marginTop: 2 }}>
              <Phone size={13} color="#A5B4FC" />
              <T variant="small" color="#C7D2FE">{me.phone}</T>
            </Row>
            <Row gap={2} style={{ marginTop: space(2) }}>
              {subtitle}
              {me.isDemoAccount && <DemoBadge text={t('profile.demoAccount')} />}
            </Row>
          </View>
        </Row>
      </View>

      <View style={{ paddingHorizontal: space(4) }}>
        {children}

        <SectionTitle>{t('profile.settings')}</SectionTitle>
        <Group>
          <View style={{ padding: space(4) }}>
            <Row gap={3} style={{ marginBottom: space(3) }}>
              <IconTile icon={Languages} tone="violet" size={40} />
              <T weight="semibold">{t('lang.title')}</T>
            </Row>
            <LanguageSwitch />
          </View>
          <Sep />
          <ListItem icon={LifeBuoy} iconTone="info" title={t('profile.support')} subtitle={t('support.note')} onPress={() => nav.push('Support')} />
          <Sep />
          <ListItem testID="sign-out" icon={LogOut} iconTone="danger" title={t('common.signOut')} onPress={signOut} chevron={false} />
        </Group>
        <T variant="caption" color={colors.ink4} center style={{ marginTop: space(6) }}>FixNow · Sen Sok pilot</T>
      </View>
    </ScrollView>
  );
}

export function CustomerProfile() {
  const { t, lang } = useI18n();
  const { me, setMe } = useAuth();
  const home = me?.customerProfile;
  const [name, setName] = useState(me?.name ?? '');
  const [address, setAddress] = useState(home?.homeAddressText ?? '');
  const [area, setArea] = useState(home?.homeArea ?? SERVICE_AREAS[0].code);
  const [msg, setMsg] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);

  const save = async () => {
    setMsg(null);
    const a = findArea(area)!;
    const samePin = home?.homeArea === area && home?.homeLat != null;
    try {
      const m = await api<Me>('/me', {
        method: 'PATCH',
        body: { name, homeAddressText: address, homeArea: area, homeLat: samePin ? home!.homeLat : a.lat, homeLng: samePin ? home!.homeLng : a.lng },
      });
      setMe(m);
      setMsg({ text: t('common.saved'), tone: 'success' });
    } catch (e) { setMsg({ text: errorText(e, t), tone: 'danger' }); }
  };

  return (
    <ProfileShell>
      <SectionTitle>{t('profile.details')}</SectionTitle>
      <Card>
        {msg && <Banner text={msg.text} tone={msg.tone} />}
        <Field icon={User} label={t('profile.name')} value={name} onChangeText={setName} testID="profile-name" />
        <AreaPicker testID="profile-area" label={t('profile.home')} value={area} onChange={setArea} />
        <Field icon={MapPin} label={t('book.address')} value={address} onChangeText={setAddress} multiline />
        <Button testID="profile-save" icon={Save} label={t('common.save')} onPress={save} />
      </Card>
    </ProfileShell>
  );
}
