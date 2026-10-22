import { Ban, FilePen, Hourglass, LifeBuoy, LogOut, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../i18n';
import { useAuth } from '../../lib/auth';
import { useNav } from '../../lib/nav';
import { Button, Card, Row, T } from '../../ui';
import { colors, radius, space } from '../../ui/theme';
import { LanguageSwitch } from '../shared/Profile';
import { BrandMark } from '../shared/Welcome';

/** Gate for technicians who are not APPROVED: they cannot see or accept any job. */
export function Pending() {
  const { t } = useI18n();
  const { me, refreshMe, signOut } = useAuth();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  // Poll our own profile so the app unlocks as soon as an admin approves.
  useEffect(() => {
    const id = setInterval(() => { refreshMe().catch(() => {}); }, 5000);
    return () => clearInterval(id);
  }, [refreshMe]);
  const tp = me?.technicianProfile;
  const status = tp?.status ?? 'PENDING';
  const content = {
    PENDING: { icon: Hourglass, tint: colors.accent, title: t('pending.title'), body: t('pending.body') },
    REJECTED: { icon: FilePen, tint: colors.danger, title: t('pending.rejected'), body: tp?.rejectionReason ? t('pending.rejectedReason', { reason: tp.rejectionReason }) : '' },
    SUSPENDED: { icon: Ban, tint: colors.danger, title: t('pending.suspended'), body: t('pending.suspendedBody') },
    APPROVED: { icon: ShieldCheck, tint: colors.success, title: '', body: '' },
  }[status];
  const Icon = content.icon;
  const steps = [t('pending.step1'), t('pending.step2'), t('pending.step3')];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ paddingBottom: space(12) }}>
      <View style={{ backgroundColor: colors.deep, paddingTop: insets.top + space(6), paddingHorizontal: space(5), paddingBottom: space(16), borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <BrandMark size={44} />
      </View>
      <View style={{ paddingHorizontal: space(4), marginTop: -space(12) }}>
        <Card testID="pending-card" style={{ alignItems: 'center', paddingVertical: space(8) }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: `${content.tint}1A` }}>
            <Icon size={36} color={content.tint} />
          </View>
          <T variant="title" center style={{ marginTop: space(4) }}>{content.title}</T>
          <T color={colors.ink3} center style={{ marginTop: space(2), maxWidth: 300 }}>{content.body}</T>
        </Card>
        {status === 'PENDING' && (
          <Card>
            {steps.map((s, i) => (
              <Row key={s} gap={3} style={{ paddingVertical: space(2) }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i === 0 ? colors.success : i === 1 ? colors.accent : colors.lineSoft }}>
                  <T size={12} weight="bold" color={i < 2 ? colors.white : colors.ink3}>{i + 1}</T>
                </View>
                <T variant="small" weight={i === 1 ? 'semibold' : 'regular'} color={i === 2 ? colors.ink3 : colors.ink}>{s}</T>
              </Row>
            ))}
          </Card>
        )}
        <View style={{ gap: space(3), marginTop: space(2) }}>
          <Button testID="check-status" icon={RefreshCw} label={t('pending.check')} onPress={async () => { await refreshMe(); }} />
          {status === 'REJECTED' && <Button variant="outline" icon={FilePen} label={t('pending.resubmit')} onPress={() => nav.push('Onboarding')} />}
          <Button variant="outline" icon={LifeBuoy} label={t('profile.support')} onPress={() => nav.push('Support')} />
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: space(4), borderWidth: 1, borderColor: colors.line }}>
            <T variant="label" weight="semibold" style={{ marginBottom: space(3) }}>{t('lang.title')}</T>
            <LanguageSwitch />
          </View>
          <Button variant="danger" icon={LogOut} label={t('common.signOut')} onPress={signOut} />
        </View>
      </View>
    </ScrollView>
  );
}
