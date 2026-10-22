import { CircleUser, CreditCard, Headset, MessageSquare, Scale, Send, ShieldAlert, Wrench, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { TICKET_CATEGORIES, type SupportTicketDto, type TicketCategory } from '@fixnow/shared';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/en';
import { api } from '../../lib/api';
import { useNav } from '../../lib/nav';
import { useApi } from '../../lib/useApi';
import { Badge, Banner, Button, Card, Chip, Empty, Field, IconTile, Row, Screen, SectionTitle, T, errorText } from '../../ui';
import { colors, radius, space, statusTone } from '../../ui/theme';

const CAT_ICON: Record<TicketCategory, LucideIcon> = {
  GENERAL: MessageSquare, PAYMENT: CreditCard, QUALITY: Wrench, DISPUTE: Scale, SAFETY: ShieldAlert, ACCOUNT: CircleUser,
};

export function Support() {
  const { t, formatDate } = useI18n();
  const { current } = useNav();
  const bookingId: string | undefined = current.params?.bookingId;
  const bookingCode: string | undefined = current.params?.bookingCode;
  const tickets = useApi<{ items: SupportTicketDto[] }>('/support-tickets');
  const [category, setCategory] = useState<TicketCategory>(bookingId ? 'QUALITY' : 'GENERAL');
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);

  const submit = async () => {
    setMsg(null);
    try {
      await api('/support-tickets', { method: 'POST', body: { category, description, bookingId } });
      setDescription('');
      setMsg({ text: t('support.sent'), tone: 'success' });
      tickets.reload(true);
    } catch (e) { setMsg({ text: errorText(e, t), tone: 'danger' }); }
  };

  return (
    <Screen title={t('support.title')} subtitle={bookingCode}>
      <View style={{ backgroundColor: colors.deep, borderRadius: radius.lg, padding: space(4), marginBottom: space(3), flexDirection: 'row', gap: space(3), alignItems: 'center' }}>
        <IconTile icon={Headset} tone="info" size={44} />
        <T variant="small" color="#E0E7FF" style={{ flex: 1 }}>{t('support.note')}</T>
      </View>
      {msg && <Banner text={msg.text} tone={msg.tone} />}
      <Card>
        <T variant="h3" style={{ marginBottom: space(3) }}>{t('support.new')}</T>
        <T variant="label" weight="semibold" color={colors.ink2} style={{ marginBottom: space(2) }}>{t('support.category')}</T>
        <Row gap={2} style={{ flexWrap: 'wrap', marginBottom: space(4) }}>
          {TICKET_CATEGORIES.map((c) => (
            <Chip key={c} icon={CAT_ICON[c]} label={t(`support.cat.${c}` as TranslationKey)} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </Row>
        <Field label={t('support.describe')} multiline value={description} onChangeText={setDescription} testID="support-description" />
        <Button testID="support-submit" icon={Send} label={t('common.submit')} onPress={submit} disabled={description.trim().length < 10} />
      </Card>

      <SectionTitle>{t('support.mine')}</SectionTitle>
      {tickets.data?.items.length === 0 && <Empty text={t('common.empty')} icon={MessageSquare} />}
      {tickets.data?.items.map((tk) => (
        <Card key={tk.id}>
          <Row style={{ alignItems: 'flex-start' }}>
            <IconTile icon={CAT_ICON[tk.category]} tone="neutral" size={38} />
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T weight="semibold">{t(`support.cat.${tk.category}` as TranslationKey)}</T>
                <Badge dot label={t(`ticket.${tk.status}` as TranslationKey)} tone={statusTone(tk.status)} />
              </Row>
              <T variant="caption" color={colors.ink4}>{tk.ticketCode}{tk.bookingCode ? ` · ${tk.bookingCode}` : ''} · {formatDate(tk.createdAt)}</T>
              <T variant="small" color={colors.ink2} style={{ marginTop: space(2) }}>{tk.description}</T>
              {tk.adminNote && (
                <View style={{ marginTop: space(3), padding: space(3), backgroundColor: colors.brandSoft, borderRadius: radius.sm, borderLeftWidth: 3, borderLeftColor: colors.brand }}>
                  <T variant="caption" weight="bold" color={colors.brandPressed}>FixNow</T>
                  <T variant="small" color={colors.ink2}>{tk.adminNote}</T>
                </View>
              )}
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
