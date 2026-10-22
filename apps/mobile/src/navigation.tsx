import { Briefcase, CalendarDays, ClipboardList, House, UserRound, Wallet, type LucideIcon } from 'lucide-react-native';
import { useCallback, type ComponentType } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from './i18n';
import type { TranslationKey } from './i18n/en';
import { useAuth } from './lib/auth';
import { NavProvider, useNav, type Route } from './lib/nav';
import { NotificationsProvider, type AppNotification } from './lib/notifications';
import { ServiceSelectionProvider } from './lib/serviceSelection';
import { NotificationToast, NotificationsScreen } from './screens/shared/NotificationsScreen';
import { CustomerBookingDetail } from './screens/customer/BookingDetail';
import { CustomerBookings } from './screens/customer/Bookings';
import { BookingForm } from './screens/customer/BookingForm';
import { CustomerHome } from './screens/customer/Home';
import { PaymentQR } from './screens/customer/PaymentQR';
import { ServiceList } from './screens/customer/ServiceList';
import { TechnicianList } from './screens/customer/TechnicianList';
import { TechnicianProfile } from './screens/customer/TechnicianProfile';
import { CustomerProfile } from './screens/shared/Profile';
import { Support } from './screens/shared/Support';
import { Earnings } from './screens/technician/Earnings';
import { JobDetail } from './screens/technician/JobDetail';
import { Jobs } from './screens/technician/Jobs';
import { Onboarding } from './screens/technician/Onboarding';
import { Pending } from './screens/technician/Pending';
import { Schedule } from './screens/technician/Schedule';
import { TechProfile } from './screens/technician/TechProfile';
import { T } from './ui';
import { colors, space } from './ui/theme';

type Tabs = Array<{ key: string; label: TranslationKey; icon: LucideIcon; root: string }>;

function StackView({ screens }: { screens: Record<string, ComponentType> }) {
  const { current, tab, stack } = useNav();
  const Screen = screens[current.name];
  if (!Screen) return null;
  // key forces a fresh mount per stack entry so params-driven screens reload correctly
  return <Screen key={`${tab}-${stack.length}-${current.name}-${JSON.stringify(current.params ?? {})}`} />;
}

function TabBar({ tabs }: { tabs: Tabs }) {
  const { t } = useI18n();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={{
      flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.lineSoft,
      paddingBottom: Math.max(insets.bottom, space(2)), paddingTop: space(2), paddingHorizontal: space(2),
    }}>
      {tabs.map((tb) => {
        const active = nav.tab === tb.key;
        const Icon = tb.icon;
        return (
          <Pressable
            key={tb.key} testID={`tab-${tb.key}`} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t(tb.label)}
            onPress={() => (active ? nav.popToRoot() : nav.switchTab(tb.key))}
            style={{ flex: 1, alignItems: 'center', minHeight: 54, justifyContent: 'center', gap: 3 }}
          >
            <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.brandSoft : 'transparent' }}>
              <Icon size={21} color={active ? colors.brand : colors.ink3} strokeWidth={active ? 2.4 : 2} />
            </View>
            <T size={11} weight={active ? 'bold' : 'medium'} color={active ? colors.brand : colors.ink3}>{t(tb.label)}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Opens the booking a notification refers to, in the right tab for the role. */
function WithNotifications({ children, bookingTab, bookingScreen }: { children: React.ReactNode; bookingTab: string; bookingScreen: string }) {
  const nav = useNav();
  const onOpen = useCallback((n: AppNotification) => {
    if (n.bookingId) nav.switchTab(bookingTab, { name: bookingScreen, params: { id: n.bookingId } });
  }, [nav, bookingTab, bookingScreen]);
  return <NotificationsProvider onOpen={onOpen}>{children}</NotificationsProvider>;
}

function TabbedApp({ tabs, screens, bookingTab, bookingScreen }: { tabs: Tabs; screens: Record<string, ComponentType>; bookingTab: string; bookingScreen: string }) {
  const roots: Record<string, Route> = Object.fromEntries(tabs.map((tb) => [tb.key, { name: tb.root }]));
  return (
    <NavProvider tabs={roots}>
      <WithNotifications bookingTab={bookingTab} bookingScreen={bookingScreen}>
        <View style={{ flex: 1 }}>
          <StackView screens={{ ...screens, Notifications: NotificationsScreen }} />
          <NotificationToast />
        </View>
        <TabBar tabs={tabs} />
      </WithNotifications>
    </NavProvider>
  );
}

// ---------------- Customer: Home, Bookings, Profile ----------------

const customerTabs: Tabs = [
  { key: 'home', label: 'tab.home', icon: House, root: 'Home' },
  { key: 'bookings', label: 'tab.bookings', icon: ClipboardList, root: 'Bookings' },
  { key: 'profile', label: 'tab.profile', icon: UserRound, root: 'Profile' },
];
const customerScreens: Record<string, ComponentType> = {
  Home: CustomerHome, ServiceList, TechnicianList, TechnicianProfile, BookingForm,
  Bookings: CustomerBookings, BookingDetail: CustomerBookingDetail, PaymentQR,
  Profile: CustomerProfile, Support,
};

export function CustomerNavigator() {
  return (
    <ServiceSelectionProvider>
      <TabbedApp tabs={customerTabs} screens={customerScreens} bookingTab="bookings" bookingScreen="BookingDetail" />
    </ServiceSelectionProvider>
  );
}

// ---------------- Technician: Jobs, Schedule, Earnings, Profile ----------------

const technicianTabs: Tabs = [
  { key: 'jobs', label: 'tab.jobs', icon: Briefcase, root: 'Jobs' },
  { key: 'schedule', label: 'tab.schedule', icon: CalendarDays, root: 'Schedule' },
  { key: 'earnings', label: 'tab.earnings', icon: Wallet, root: 'Earnings' },
  { key: 'profile', label: 'tab.profile', icon: UserRound, root: 'Profile' },
];
const technicianScreens: Record<string, ComponentType> = {
  Jobs, JobDetail, Schedule, Earnings, Profile: TechProfile, Support,
};

export function TechnicianNavigator() {
  const { me } = useAuth();
  const status = me?.technicianProfile?.status;
  // Not yet registered: onboarding only. Not approved: pending gate only (no jobs visible).
  if (!me?.technicianProfile) {
    return <NavProvider tabs={{ onboarding: { name: 'Onboarding' } }}><StackView screens={{ Onboarding, Support }} /></NavProvider>;
  }
  if (status !== 'APPROVED') {
    return <NavProvider tabs={{ pending: { name: 'Pending' } }}><StackView screens={{ Pending, Onboarding, Support }} /></NavProvider>;
  }
  return <TabbedApp tabs={technicianTabs} screens={technicianScreens} bookingTab="jobs" bookingScreen="JobDetail" />;
}
