import { CircleCheck, ShieldCheck, Wrench, Zap, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useI18n } from '../i18n';
import { T } from './index';
import { colors, radius, space } from './theme';

// Scene coordinates are in a 320 × 200 box; overlays use percentages of it so everything scales with the screen width.
const W = 320, H = 200;
const pct = (v: number, of: number) => `${(v / of) * 100}%` as const;

function Badge({ x, y, size, bg, icon: Icon }: { x: number; y: number; size: number; bg: string; icon: LucideIcon }) {
  return (
    <View style={{
      position: 'absolute', left: pct(x, W), top: pct(y, H), width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2,
      borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: 'rgba(255,255,255,0.18)',
    }}>
      <Icon size={size * 0.48} color={colors.white} strokeWidth={2.4} />
    </View>
  );
}

function FloatCard({ icon: Icon, tone, title, subtitle, style }: {
  icon: LucideIcon; tone: { bg: string; fg: string }; title: string; subtitle: string; style: object;
}) {
  return (
    <View style={[{
      position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: space(2), maxWidth: '62%',
      backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: space(2), paddingHorizontal: space(2.5),
      shadowColor: '#020617', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
    }, style]}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} color={tone.fg} strokeWidth={2.4} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <T size={12} weight="bold" numberOfLines={1}>{title}</T>
        <T size={11} color={colors.ink3} numberOfLines={1}>{subtitle}</T>
      </View>
    </View>
  );
}

/** Decorative welcome scene: a Sen Sok home with its AC unit, service badges and two "how it works" cards. */
export function HeroIllustration() {
  const { t } = useI18n();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: '100%', aspectRatio: W / H }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="55%" r="50%">
            <Stop offset="0" stopColor={colors.brand} stopOpacity="0.55" />
            <Stop offset="1" stopColor={colors.brand} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={170} cy={112} r={104} fill="url(#glow)" />
        {[[28, 30], [300, 96], [140, 18], [36, 100], [292, 22]].map(([cx, cy]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.8} fill={colors.white} opacity={0.35} />
        ))}
        <Ellipse cx={170} cy={180} rx={140} ry={9} fill={colors.white} opacity={0.07} />

        {/* tree */}
        <Rect x={58} y={142} width={6} height={38} rx={2} fill="#7C4A1E" />
        <Circle cx={61} cy={128} r={22} fill="#22C55E" />
        <Circle cx={48} cy={140} r={14} fill="#16A34A" />
        <Circle cx={72} cy={118} r={9} fill="#4ADE80" opacity={0.8} />

        {/* house */}
        <Rect x={207} y={60} width={14} height={30} rx={2} fill="#1E3A8A" />
        <Rect x={112} y={98} width={118} height={82} rx={4} fill="#F8FAFF" />
        <Rect x={112} y={98} width={118} height={9} fill="#DCE5FF" />
        <Path d="M100 104 L171 50 L242 104 Z" fill={colors.brand} />
        <Path d="M100 104 L171 50 L242 104" stroke={colors.brandPressed} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" fill="none" />
        <Circle cx={171} cy={80} r={8} fill="#FDE68A" />
        <Rect x={124} y={118} width={26} height={24} rx={3} fill="#FDE68A" />
        <Path d="M137 118 V142 M124 130 H150" stroke="#F59E0B" strokeWidth={2} />
        <Rect x={194} y={118} width={24} height={24} rx={3} fill="#FDE68A" />
        <Path d="M206 118 V142 M194 130 H218" stroke="#F59E0B" strokeWidth={2} />
        <Rect x={158} y={134} width={26} height={46} rx={3} fill={colors.accent} />
        <Circle cx={178} cy={158} r={2} fill={colors.white} />

        {/* AC outdoor unit with cool air */}
        <Path d="M230 140 C238 140 240 146 242 150" stroke="#CBD5E1" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Rect x={240} y={146} width={46} height={34} rx={5} fill="#E2E8F0" stroke="#CBD5E1" strokeWidth={1.5} />
        <Circle cx={257} cy={163} r={11} fill="#94A3B8" />
        <Circle cx={257} cy={163} r={3.5} fill="#475569" />
        <Path d="M272 155 H280 M272 160 H280 M272 165 H280 M272 170 H280" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" />
        <Path d="M248 136 q6 -6 12 0 t12 0 t12 0" stroke="#7DD3FC" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Path d="M254 126 q6 -6 12 0 t12 0" stroke="#7DD3FC" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.6} />
      </Svg>

      <Badge x={74} y={66} size={34} bg="#EAB308" icon={Zap} />
      <Badge x={118} y={40} size={30} bg={colors.accent} icon={Wrench} />
      <FloatCard icon={CircleCheck} tone={{ bg: colors.successSoft, fg: colors.success }}
        title={t('welcome.card.accepted')} subtitle={t('welcome.card.acceptedNote')} style={{ right: 0, top: '2%' }} />
      <FloatCard icon={ShieldCheck} tone={{ bg: colors.brandSoft, fg: colors.brand }}
        title={t('welcome.card.verified')} subtitle={t('welcome.card.verifiedNote')} style={{ left: 0, bottom: '-4%' }} />
    </View>
  );
}
