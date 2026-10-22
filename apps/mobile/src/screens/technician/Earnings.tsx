import { Banknote, Hourglass, Landmark, Receipt } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatUsd, type EarningsDto } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { useApi } from '../../lib/useApi';
import { Badge, Banner, BellButton, Card, DemoBadge, Divider, ErrorState, IconTile, KeyValue, Loading, Row, SectionTitle, T } from '../../ui';
import { serviceIcon } from '../../ui/booking';
import { colors, radius, space, statusTone } from '../../ui/theme';

export function Earnings() {
  const { t, pick, formatDate } = useI18n();
  const insets = useSafeAreaInsets();
  const q = useApi<EarningsDto>('/technician/earnings', { pollMs: 15000 });
  if (q.loading && !q.data) return <Loading />;
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => q.reload()} />;
  const e = q.data!;
  const gross = Number(e.totals.gross);
  const commissionPct = gross > 0 ? Number(e.totals.commission) / gross : 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.canvas }} contentContainerStyle={{ paddingBottom: space(12) }} showsVerticalScrollIndicator={false}>
      <View style={{ backgroundColor: colors.deep, paddingTop: insets.top + space(4), paddingHorizontal: space(5), paddingBottom: space(6), borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="title" color={colors.white}>{t('earn.title')}</T>
          <BellButton light />
        </Row>
        <T variant="small" color="#A5B4FC" style={{ marginTop: space(5) }}>{t('earn.net')}</T>
        <T size={38} weight="bold" color={colors.white}>{formatUsd(e.totals.net)}</T>
        <T variant="caption" color="#A5B4FC">{e.totals.jobs} {t('earn.jobs').toLowerCase()} · {t('earn.beforeFees')}</T>
        <Row gap={3} style={{ marginTop: space(4) }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: space(3) }}>
            <Row gap={1.5}><Hourglass size={14} color={colors.accent} /><T variant="caption" color="#C7D2FE">{t('earn.pendingPayout')}</T></Row>
            <T variant="h3" color={colors.white} style={{ marginTop: 2 }}>{formatUsd(e.totals.pendingPayout)}</T>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: space(3) }}>
            <Row gap={1.5}><Landmark size={14} color="#86EFAC" /><T variant="caption" color="#C7D2FE">{t('earn.paidOut')}</T></Row>
            <T variant="h3" color={colors.white} style={{ marginTop: 2 }}>{formatUsd(e.totals.paidOut)}</T>
          </View>
        </Row>
      </View>

      <View style={{ paddingHorizontal: space(4), paddingTop: space(4) }}>
        <Banner text={t('earn.demoNote')} tone="accent" />
        <Card testID="earnings-breakdown">
          <T variant="h3">{t('earn.breakdown')}</T>
          <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginVertical: space(4) }}>
            <View style={{ flex: 1 - commissionPct || 1, backgroundColor: colors.success }} />
            {commissionPct > 0 && <View style={{ width: 2, backgroundColor: colors.surface }} />}
            {commissionPct > 0 && <View style={{ flex: commissionPct, backgroundColor: colors.ink4 }} />}
          </View>
          <KeyValue label={t('earn.gross')} value={formatUsd(e.totals.gross)} />
          <KeyValue label={t('earn.commission', { rate: Number(e.commissionRate) })} value={`− ${formatUsd(e.totals.commission)}`} />
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={2}><View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.success }} /><T weight="semibold">{t('earn.net')}</T></Row>
            <T variant="h3" color={colors.success}>{formatUsd(e.totals.net)}</T>
          </Row>
        </Card>

        <SectionTitle>{t('earn.jobs')}</SectionTitle>
        {e.items.length === 0 && <T color={colors.ink3}>{t('earn.noJobs')}</T>}
        {e.items.map((i) => (
          <Card key={i.bookingId}>
            <Row style={{ alignItems: 'flex-start' }}>
              <IconTile icon={serviceIcon(i.serviceNameEn)} tone="info" size={40} />
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{pick(i.serviceNameEn, i.serviceNameKm)}</T>
                  <T weight="bold" color={colors.success}>{formatUsd(i.net)}</T>
                </Row>
                <T variant="caption" color={colors.ink4}>{i.bookingCode}{i.paidAt ? ` · ${formatDate(i.paidAt)}` : ''}</T>
                <T variant="caption" color={colors.ink3} style={{ marginTop: space(1.5) }}>
                  {formatUsd(i.gross)} − {formatUsd(i.commission)} ({Number(i.commissionRate)}%) = {formatUsd(i.net)}
                </T>
                <Row gap={2} style={{ marginTop: space(2) }}>
                  {i.payoutStatus && <Badge dot label={t(`payout.${i.payoutStatus}` as TranslationKey)} tone={statusTone(i.payoutStatus === 'PENDING' ? 'REQUESTED' : i.payoutStatus)} />}
                  {i.isDemo && <DemoBadge />}
                </Row>
              </View>
            </Row>
          </Card>
        ))}

        <SectionTitle>{t('earn.payouts')}</SectionTitle>
        {e.payouts.length === 0 && <T color={colors.ink3}>{t('earn.noPayouts')}</T>}
        {e.payouts.length > 0 && (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {e.payouts.map((p, idx) => (
              <View key={p.id} style={[{ padding: space(4), flexDirection: 'row', alignItems: 'center', gap: space(3) }, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.lineSoft }]}>
                <IconTile icon={p.status === 'PAID' ? Banknote : Receipt} tone={p.status === 'PAID' ? 'success' : 'neutral'} size={38} />
                <View style={{ flex: 1 }}>
                  <T weight="semibold">{formatUsd(p.amount)}</T>
                  <T variant="caption" color={colors.ink4}>{p.reference ?? p.method.replace('_', ' ')} · {formatDate(p.paidAt ?? p.createdAt)}</T>
                </View>
                <Badge dot label={t(`payout.${p.status}` as TranslationKey)} tone={statusTone(p.status === 'PENDING' ? 'REQUESTED' : p.status)} />
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
