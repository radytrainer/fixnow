import { CircleCheck, Hourglass, Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { formatUsd, type BookingDto } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import { api } from '../../lib/api';
import { useNav } from '../../lib/nav';
import { useApi } from '../../lib/useApi';
import { Banner, Button, Card, DemoBadge, ErrorState, KeyValue, Loading, Row, Screen, T } from '../../ui';
import { colors, radius, space } from '../../ui/theme';

interface Qr { paymentId: string; bookingCode: string; amount: string; currency: string; qrPayload: string; qrImageDataUrl: string; isDemo: boolean; notice: string }

/** Shows the booking-linked (simulated) QR and polls until an operator confirms the payment. */
export function PaymentQR() {
  const { t } = useI18n();
  const nav = useNav();
  const id: string = nav.current.params?.id;
  const [qr, setQr] = useState<Qr | null>(null);
  const [error, setError] = useState<unknown>(null);
  const booking = useApi<BookingDto>(`/bookings/${id}`, { pollMs: 3000 });
  const paid = booking.data && booking.data.payment?.status === 'PAID';

  useEffect(() => {
    api<Qr>(`/bookings/${id}/payment/qr`, { method: 'POST' }).then(setQr).catch(setError);
  }, [id]);

  if (paid) {
    return (
      <Screen title={t('pay.title')}>
        <Card style={{ alignItems: 'center', paddingVertical: space(10) }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <CircleCheck size={48} color={colors.success} />
          </View>
          <T variant="title" style={{ marginTop: space(4) }}>{t('pay.confirmed')}</T>
          <T size={32} weight="bold" color={colors.success} style={{ marginTop: space(1) }}>{formatUsd(booking.data!.payment!.amount)}</T>
          {booking.data!.payment!.isDemo && <View style={{ marginTop: space(3) }}><DemoBadge text={t('pay.demoBanner')} /></View>}
        </Card>
        <Button testID="back-to-booking" icon={Star} label={t('detail.rate')} onPress={nav.pop} />
      </Screen>
    );
  }
  if (error) return <ErrorState error={error} onRetry={nav.pop} />;
  if (!qr) return <Loading />;

  return (
    <Screen title={t('pay.title')}>
      {qr.isDemo && <Banner tone="accent" text={t('pay.demoBanner')} />}
      <View style={{ backgroundColor: colors.deep, borderRadius: radius.xl, padding: space(5), alignItems: 'center' }}>
        <T variant="small" color="#A5B4FC">FixNow · {qr.bookingCode}</T>
        <T size={36} weight="bold" color={colors.white} style={{ marginTop: space(1) }}>{formatUsd(qr.amount)}</T>
        <View style={{ backgroundColor: colors.white, borderRadius: radius.lg, padding: space(4), marginTop: space(4) }}>
          <Image testID="payment-qr" accessibilityLabel={`Payment QR for ${qr.bookingCode}`} source={{ uri: qr.qrImageDataUrl }} style={{ width: 232, height: 232 }} />
        </View>
        <T variant="small" color="#C7D2FE" center style={{ marginTop: space(4), maxWidth: 280 }}>{t('pay.instructions')}</T>
      </View>

      <Card style={{ marginTop: space(3) }}>
        <KeyValue label={t('pay.reference')} value={qr.bookingCode} />
        <KeyValue label={t('detail.amount')} value={`${qr.amount} ${qr.currency}`} />
        <T variant="caption" color={colors.ink4} style={{ marginTop: space(2) }} numberOfLines={2}>{qr.qrPayload}</T>
      </Card>
      <Card style={{ backgroundColor: colors.brandSoft, borderColor: colors.brandLine }}>
        <Row>
          <Hourglass size={18} color={colors.brand} />
          <T variant="small" weight="semibold" color={colors.brandPressed} style={{ flex: 1 }}>{t('pay.waiting')}</T>
          <ActivityIndicator color={colors.brand} />
        </Row>
      </Card>
    </Screen>
  );
}
