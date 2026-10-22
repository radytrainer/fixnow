/**
 * FixNow demo dataset. Run via `npm run db:reset` (services/api).
 *
 * Deterministic (fixed PRNG seed) but time-relative: everything is placed relative to "now", so
 * charts, countdowns and the 3-day warranty window always look current after a reset.
 * All payments are DEMO (simulated). Khmer strings are machine-assisted and need native review.
 *
 * Contents: 4 categories / 23 services, 12 customers, 14 technicians (10 approved, 2 pending,
 * 1 rejected, 1 suspended), ~90 bookings in every status (incl. 3 live 5-minute requests),
 * payments, payouts, ratings, warranty claims, support tickets, notifications and an audit trail.
 */
import { MAX_TECHNICIAN_DISTANCE_KM, distanceKm, findArea } from '../../packages/shared/src/areas';
import { splitCommission } from '../../packages/shared/src/money';

type Q = (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;

export const DEMO_ADMIN = { phone: '+85512000001', password: 'FixNowAdmin#2026', name: 'Sreyneang (FixNow Ops)' };
export const DEMO_FINANCE_ADMIN = { phone: '+85512000002', name: 'Visal (FixNow Finance)' };

// ---------------------------------------------------------------- helpers

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261018);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);
const weighted = <T extends string>(w: Record<T, number>): T => {
  const total = Object.values<number>(w).reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (const [k, v] of Object.entries<number>(w)) { r -= v; if (r <= 0) return k as T; }
  return Object.keys(w)[0] as T;
};
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

// Any area code from the shared Cambodia-wide list.
const AREAS = new Proxy({} as Record<string, { lat: number; lng: number }>, { get: (_t, code: string) => findArea(code)! });
type Area = string;

// ---------------------------------------------------------------- catalogue

const CATEGORIES = [
  { code: 'AC', en: 'Air Conditioning', km: 'ម៉ាស៊ីនត្រជាក់', icon: 'ac', status: 'ACTIVE' },
  { code: 'ELECTRICAL', en: 'Electrical', km: 'អគ្គិសនី', icon: 'bolt', status: 'ACTIVE' },
  { code: 'PLUMBING', en: 'Plumbing', km: 'ប្រព័ន្ធទឹក', icon: 'drop', status: 'ACTIVE' },
  { code: 'APPLIANCES', en: 'Home Appliances', km: 'គ្រឿងប្រើប្រាស់ក្នុងផ្ទះ', icon: 'washer', status: 'COMING_SOON' },
] as const;

const SERVICES = [
  // key, category, en, km, descEn, descKm, min, max, status
  ['acClean', 'AC', 'AC Cleaning', 'លាងម៉ាស៊ីនត្រជាក់', 'Indoor and outdoor unit cleaning, filter wash and drain check.', 'លាងសម្អាតម៉ាស៊ីនខាងក្នុង និងខាងក្រៅ លាងតម្រង និងពិនិត្យបំពង់ទឹក។', '15.00', '30.00'],
  ['acRepair', 'AC', 'AC Repair', 'ជួសជុលម៉ាស៊ីនត្រជាក់', 'Diagnose and fix cooling, noise, leaking or power problems.', 'ពិនិត្យ និងជួសជុលបញ្ហាមិនត្រជាក់ សំឡេង លេចទឹក ឬភ្លើង។', '20.00', '80.00'],
  ['acGas', 'AC', 'AC Gas Refill', 'បញ្ចូលហ្គាសម៉ាស៊ីនត្រជាក់', 'Leak check and refrigerant top-up (R32 / R410A).', 'ពិនិត្យការលេច និងបញ្ចូលហ្គាស (R32 / R410A)។', '25.00', '50.00'],
  ['acInstall', 'AC', 'AC Installation', 'តម្លើងម៉ាស៊ីនត្រជាក់', 'Install a split-type unit up to 2HP. Pipes and brackets extra.', 'តម្លើងម៉ាស៊ីនត្រជាក់ប្រភេទបំបែក រហូតដល់ 2HP។', '30.00', '90.00'],
  ['acMaint', 'AC', 'AC Check-up', 'ពិនិត្យថែទាំម៉ាស៊ីនត្រជាក់', 'Seasonal inspection: pressure, electrical, airflow and drain.', 'ពិនិត្យតាមរដូវ៖ សម្ពាធ ភ្លើង ខ្យល់ និងបំពង់ទឹក។', '12.00', '25.00'],
  ['acMove', 'AC', 'AC Relocation', 'ផ្លាស់ទីតាំងម៉ាស៊ីនត្រជាក់', 'Remove and reinstall a unit in a new room or apartment.', 'រុះ និងតម្លើងម៉ាស៊ីននៅបន្ទប់ ឬផ្ទះថ្មី។', '40.00', '100.00'],
  ['elWiring', 'ELECTRICAL', 'Wiring Repair', 'ជួសជុលខ្សែភ្លើង', 'Fix faulty wiring, short circuits and sparking sockets.', 'ជួសជុលខ្សែភ្លើងខូច ឆ្លងចរន្ត និងព្រីភ្លើងចេញផ្កាភ្លើង។', '10.00', '60.00'],
  ['elOutlet', 'ELECTRICAL', 'Outlet & Switch Install', 'តម្លើងព្រីភ្លើង និងកុងតាក់', 'Install or replace sockets, USB outlets and switches.', 'តម្លើង ឬប្តូរព្រីភ្លើង ព្រី USB និងកុងតាក់។', '8.00', '25.00'],
  ['elBreaker', 'ELECTRICAL', 'Breaker & Fuse Repair', 'ជួសជុលឌីស្យុងទ័រ', 'Breaker tripping, fuse box faults, RCD testing.', 'ឌីស្យុងទ័រដាច់ញឹកញាប់ ប្រអប់ហ្វុយស៊ីបខូច។', '10.00', '40.00'],
  ['elLight', 'ELECTRICAL', 'Lighting Installation', 'តម្លើងអំពូលភ្លើង', 'Ceiling lights, LED panels and strip lighting.', 'តម្លើងអំពូលពិដាន បន្ទះ LED និងខ្សែអំពូល។', '10.00', '35.00'],
  ['elFan', 'ELECTRICAL', 'Ceiling Fan Installation', 'តម្លើងកង្ហារពិដាន', 'Mount and wire a ceiling fan with wall control.', 'តម្លើង និងតភ្ជាប់កង្ហារពិដានជាមួយកុងតាក់។', '12.00', '30.00'],
  ['elHeater', 'ELECTRICAL', 'Water Heater Wiring', 'តភ្ជាប់ភ្លើងម៉ាស៊ីនកម្តៅទឹក', 'Dedicated circuit and safe wiring for shower heaters.', 'ខ្សែភ្លើងដាច់ដោយឡែក និងសុវត្ថិភាពសម្រាប់ម៉ាស៊ីនកម្តៅទឹក។', '15.00', '45.00'],
  ['elSafety', 'ELECTRICAL', 'Electrical Safety Inspection', 'ត្រួតពិនិត្យសុវត្ថិភាពអគ្គិសនី', 'Full home check before moving in: earthing, RCD, overloads.', 'ពិនិត្យផ្ទះទាំងមូលមុនចូលនៅ៖ ខ្សែដី RCD និងការផ្ទុកលើស។', '15.00', '30.00'],
  ['plLeak', 'PLUMBING', 'Pipe Leak Repair', 'ជួសជុលបំពង់ទឹកលេច', 'Find and fix leaking pipes, joints and valves (PVC / PPR).', 'ស្វែងរក និងជួសជុលបំពង់ សន្លាក់ និងវ៉ាល់លេចទឹក។', '10.00', '40.00'],
  ['plDrain', 'PLUMBING', 'Drain Unclogging', 'ដោះស្ទះលូ', 'Clear blocked sinks, floor drains and shower drains.', 'ដោះស្ទះលិចទឹក លូឥដ្ឋ និងលូបន្ទប់ទឹក។', '10.00', '35.00'],
  ['plToilet', 'PLUMBING', 'Toilet Repair', 'ជួសជុលបង្គន់', 'Running or leaking toilets, flush valves, blocked toilets.', 'បង្គន់ហូរទឹកមិនឈប់ លេច ឬស្ទះ ជួសជុលប្រដាប់ចុចទឹក។', '10.00', '40.00'],
  ['plPump', 'PLUMBING', 'Water Pump Repair', 'ជួសជុលម៉ាស៊ីនបូមទឹក', 'Low water pressure, pump not starting, pressure tank issues.', 'សម្ពាធទឹកខ្សោយ ម៉ាស៊ីនបូមមិនដើរ បញ្ហាធុងសម្ពាធ។', '15.00', '60.00'],
  ['plFaucet', 'PLUMBING', 'Faucet & Sink Installation', 'តម្លើងក្បាលរ៉ូប៊ីណេ និងលិចទឹក', 'Install or replace taps, sinks, shower sets and hoses.', 'តម្លើង ឬប្តូរក្បាលរ៉ូប៊ីណេ លិចទឹក ឈុតផ្កាឈូក និងទុយោ។', '8.00', '30.00'],
  ['apWasher', 'APPLIANCES', 'Washing Machine Repair', 'ជួសជុលម៉ាស៊ីនបោកខោអាវ', 'Coming soon.', 'នឹងមកដល់ឆាប់ៗ។', '15.00', '50.00', 'COMING_SOON'],
  ['apFridge', 'APPLIANCES', 'Refrigerator Repair', 'ជួសជុលទូទឹកកក', 'Coming soon.', 'នឹងមកដល់ឆាប់ៗ។', '20.00', '70.00', 'COMING_SOON'],
  ['apTv', 'APPLIANCES', 'TV Wall Mounting', 'តម្លើងទូរទស្សន៍លើជញ្ជាំង', 'Coming soon.', 'នឹងមកដល់ឆាប់ៗ។', '10.00', '30.00', 'COMING_SOON'],
] as const;
type ServiceKey = typeof SERVICES[number][0];

const PROBLEMS: Partial<Record<ServiceKey, string[]>> = {
  acClean: ['Two bedroom units need cleaning, airflow is weak.', 'AC smells musty when switched on.', 'Haven\'t cleaned the AC in a year, please service 3 units.'],
  acRepair: ['AC blows warm air and drips water onto the wall.', 'Outdoor unit makes a loud rattling noise.', 'AC turns off by itself after 10 minutes.', 'Remote works but the AC does not start.'],
  acGas: ['AC is running but not cold. Maybe needs gas.', 'Ice forming on the pipes of the outdoor unit.'],
  acInstall: ['Install a new 1.5HP Daikin in the living room.', 'Need a 1HP unit installed in the kids\' bedroom.'],
  acMaint: ['Quick check before the hot season, 2 units.', 'Landlord asked for a check-up report.'],
  acMove: ['Moving apartment, need the AC moved to the new place in Sen Sok City.'],
  elWiring: ['Kitchen socket sparks when plugging in the kettle.', 'Lights flicker in the bedroom.', 'Burning smell from a wall switch.'],
  elOutlet: ['Replace 3 old sockets with USB sockets.', 'Add a new outlet next to the bed.'],
  elBreaker: ['Breaker trips when the water heater turns on.', 'Main breaker trips every evening.'],
  elLight: ['Install 4 ceiling lights in the living room.', 'Replace old tube lights with LED panels.'],
  elFan: ['Mount a ceiling fan in the bedroom, I have the fan already.'],
  elHeater: ['New shower heater needs safe wiring.', 'Water heater trips the breaker.'],
  elSafety: ['Moving into a rented flat, want a safety check first.'],
  plLeak: ['Kitchen sink pipe is leaking under the cabinet.', 'Water dripping from the ceiling below the bathroom.', 'Leak at the main valve near the water meter.'],
  plDrain: ['Bathroom floor drain is blocked and smells.', 'Kitchen sink drains very slowly.'],
  plToilet: ['Toilet keeps running after flushing.', 'Toilet is blocked, plunger did not help.'],
  plPump: ['Water pressure upstairs is very weak.', 'Pump turns on and off every few seconds.'],
  plFaucet: ['Replace the old kitchen tap and the bathroom shower set.', 'Install a new sink in the laundry area.'],
};

const COMMENTS: Record<number, string[]> = {
  5: ['Very clean work, explained everything.', 'Arrived on time and fixed it fast.', 'Professional and friendly. Will book again.',
    'ជាងមកដល់ទាន់ពេល ធ្វើការស្អាត។ អរគុណច្រើន!', 'Fair price and good advice on maintenance.', 'Great service, AC is cold again!'],
  4: ['Good job, arrived 15 minutes late.', 'Fixed the problem, left a little dust.', 'Solid work. Easy to book.', 'ធ្វើការល្អ ប៉ុន្តែមកយឺតបន្តិច។'],
  3: ['Problem fixed but took longer than expected.', 'OK service, price was at the top of the range.'],
  2: ['Had to contact support to follow up.'],
};

const CANCEL_REASONS = ['Fixed it myself', 'Booked by mistake', 'Landlord will send his own technician', 'Need a different time', 'Found a technician closer to home'];

// ---------------------------------------------------------------- people

const CUSTOMERS = [
  // key, phone, name, lang, area, address, demo
  ['sokha', '+85512000101', 'Sokha Chan', 'en', 'PHNOM_PENH_THMEI', 'Borey Peng Huoth The Star Platinum, St. 1986, House 12B', true],
  ['dara', '+85512000102', 'Dara Kim', 'km', 'TUEK_THLA', 'Street 598, House 45, near Tuek Thla market', true],
  ['malis', '+85512000103', 'Malis Ouk', 'en', 'PHNOM_PENH_THMEI', 'Sen Sok City, Block C, Unit 7', true],
  ['pisey', '+85512000104', 'Pisey Nhem', 'km', 'TUEK_THLA', 'Borey Vimean Phnom Penh, St. 371, House 88', false],
  ['rotha', '+85512000105', 'Rotha Seng', 'en', 'PHNOM_PENH_THMEI', 'St. 1003, near Phnom Penh Thmei market, Flat 3A', false],
  ['lina', '+85512000106', 'Lina Tan', 'en', 'PHNOM_PENH_THMEI', 'Borey Chankiri, St. 2011, House 21', false],
  ['chenda', '+85512000107', 'Chenda Hok', 'km', 'TUEK_THLA', 'St. 1019, House 14, Tuek Thla commune', false],
  ['bunthoeun', '+85512000108', 'Bunthoeun Ros', 'km', 'PHNOM_PENH_THMEI', 'Borey Sopheakmongkol, St. 2002, House 5', false],
  ['sreynich', '+85512000109', 'Sreynich Vann', 'en', 'TUEK_THLA', 'Rose Condo, Tower B, Room 1204', false],
  ['mony', '+85512000110', 'Mony Chea', 'km', 'PHNOM_PENH_THMEI', 'St. 1928, House 9, behind AEON Mall Sen Sok', false],
  ['kanha', '+85512000111', 'Kanha Pov', 'en', 'TUEK_THLA', 'Borey New World, St. 598, House 302', false],
  ['david', '+85512000112', 'David Lee', 'en', 'PHNOM_PENH_THMEI', 'Sen Sok City, Block F, Unit 19', false],
  ['sophie', '+85512000113', 'Sophie Martin', 'en', 'PP_BOENG_KENG_KANG', 'St. 278, Apartment 4B, BKK1', false],
  ['vibol', '+85512000114', 'Vibol Chhay', 'km', 'PV_SIEM_REAP', 'Wat Bo Road, House 33, Siem Reap town', false],
] as const;
type CustomerKey = typeof CUSTOMERS[number][0];

interface TechSpec {
  key: string; phone: string; name: string; bio: string; years: number; area: Area; status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'SUSPENDED';
  services: ServiceKey[]; cert: string; idNo: string; demo: boolean; available?: boolean; reason?: string; joinedDaysAgo: number; skill: number;
}
const TECHS: TechSpec[] = [
  { key: 'vannak', phone: '+85512000201', name: 'Vannak Sok', bio: 'AC specialist, Daikin & Panasonic trained. Clean, on time, explains the fix.', years: 7, area: 'PHNOM_PENH_THMEI', status: 'APPROVED', services: ['acClean', 'acRepair', 'acGas', 'acInstall', 'acMaint'], cert: 'NTTI Refrigeration & AC Certificate (2018)', idNo: '010203045', demo: true, joinedDaysAgo: 60, skill: 1.05 },
  { key: 'sophea', phone: '+85512000202', name: 'Sophea Lim', bio: 'Licensed electrician for homes and shophouses. Safety first.', years: 5, area: 'TUEK_THLA', status: 'APPROVED', services: ['elWiring', 'elOutlet', 'elBreaker', 'elLight', 'elHeater'], cert: 'Electrical Installation Level 2, Don Bosco Technical School', idNo: '020304056', demo: true, joinedDaysAgo: 58, skill: 0.8 },
  { key: 'rithy', phone: '+85512000203', name: 'Rithy Heng', bio: 'AC and electrical all-rounder. Weekend availability.', years: 4, area: 'TUEK_THLA', status: 'APPROVED', services: ['acClean', 'acRepair', 'elOutlet', 'elLight'], cert: 'Basic AC Servicing Certificate', idNo: '030405067', demo: true, joinedDaysAgo: 55, skill: 0.75 },
  { key: 'dararith', phone: '+85512000206', name: 'Dararith Chea', bio: '9 years in residential wiring. Breakers, fans and full safety inspections.', years: 9, area: 'PHNOM_PENH_THMEI', status: 'APPROVED', services: ['elWiring', 'elBreaker', 'elFan', 'elSafety', 'elHeater'], cert: 'EDC-registered electrician; RCD testing course (2021)', idNo: '060708091', demo: false, joinedDaysAgo: 52, skill: 0.85 },
  { key: 'sovann', phone: '+85512000207', name: 'Sovann Pich', bio: 'AC installs and gas refills. Brings his own vacuum pump and gauges.', years: 5, area: 'PHNOM_PENH_THMEI', status: 'APPROVED', services: ['acClean', 'acGas', 'acInstall', 'acMove'], cert: 'Refrigerant Handling Certificate (2020)', idNo: '070809102', demo: false, joinedDaysAgo: 48, skill: 0.7 },
  { key: 'kimsour', phone: '+85512000208', name: 'Kimsour Ly', bio: 'Repairs inverter ACs and small electrical jobs.', years: 6, area: 'TUEK_THLA', status: 'APPROVED', services: ['acRepair', 'acMaint', 'elOutlet', 'elWiring'], cert: 'Inverter AC Repair Workshop, Samsung Academy', idNo: '080910113', demo: false, joinedDaysAgo: 45, skill: 0.8 },
  { key: 'phearom', phone: '+85512000209', name: 'Phearom Tep', bio: 'Lighting and fan installs. Neat cable work.', years: 3, area: 'PHNOM_PENH_THMEI', status: 'APPROVED', services: ['elLight', 'elFan', 'elOutlet'], cert: 'Electrical Basics Level 1, PPI', idNo: '091011124', demo: false, joinedDaysAgo: 40, skill: 0.7 },
  { key: 'chanthy', phone: '+85512000210', name: 'Chanthy Mao', bio: 'New to FixNow. AC cleaning and seasonal check-ups.', years: 2, area: 'TUEK_THLA', status: 'APPROVED', services: ['acClean', 'acMaint'], cert: 'AC Servicing Short Course (2023)', idNo: '101112135', demo: false, joinedDaysAgo: 12, skill: 0.65 },
  { key: 'narin', phone: '+85512000211', name: 'Narin Keo', bio: 'Senior electrician. Water heaters, breakers and rewiring.', years: 11, area: 'PHNOM_PENH_THMEI', status: 'APPROVED', services: ['elHeater', 'elWiring', 'elBreaker', 'elSafety'], cert: 'Electrical Engineering Diploma, ITC', idNo: '111213146', demo: false, joinedDaysAgo: 50, skill: 0.92 },
  { key: 'sreymom', phone: '+85512000212', name: 'Sreymom Chhun', bio: 'AC installation and relocation. Careful with walls and finishes.', years: 8, area: 'TUEK_THLA', status: 'APPROVED', services: ['acInstall', 'acMove', 'acGas', 'acClean'], cert: 'Daikin Certified Installer (2019)', idNo: '121314157', demo: false, joinedDaysAgo: 47, skill: 0.88 },
  { key: 'sokun', phone: '+85512000215', name: 'Sokun Prak', bio: 'Covers Tuol Kouk, Russey Keo and Sen Sok. Electrical and AC cleaning.', years: 6, area: 'PP_TUOL_KOUK', status: 'APPROVED', services: ['elWiring', 'elOutlet', 'elLight', 'acClean'], cert: 'Electrical Installation Level 2, NPIC', idNo: '151617180', demo: false, joinedDaysAgo: 30, skill: 0.82 },
  { key: 'channa', phone: '+85512000216', name: 'Channa Ouk', bio: 'AC technician for condos in BKK1, Chamkar Mon and Doun Penh.', years: 7, area: 'PP_CHAMKAR_MON', status: 'APPROVED', services: ['acClean', 'acRepair', 'acGas', 'acMaint'], cert: 'Mitsubishi Electric Service Training (2020)', idNo: '161718191', demo: false, joinedDaysAgo: 26, skill: 0.85 },
  { key: 'rachana', phone: '+85512000217', name: 'Rachana Mok', bio: 'Siem Reap based. Guesthouses and homes: AC and electrical.', years: 5, area: 'PV_SIEM_REAP', status: 'APPROVED', services: ['acClean', 'acRepair', 'elWiring', 'elLight'], cert: 'Siem Reap Provincial Training Centre', idNo: '171819202', demo: false, joinedDaysAgo: 20, skill: 0.8 },
  { key: 'piseth', phone: '+85512000218', name: 'Piseth Long', bio: 'Plumber for houses and condos: leaks, drains, toilets and pumps. Brings common spare parts.', years: 8, area: 'PHNOM_PENH_THMEI', status: 'APPROVED', services: ['plLeak', 'plDrain', 'plToilet', 'plPump', 'plFaucet'], cert: 'Plumbing & Sanitation Certificate, NTTI (2017)', idNo: '181920213', demo: true, joinedDaysAgo: 56, skill: 0.95 },
  { key: 'sambath', phone: '+85512000219', name: 'Sambath Nhim', bio: 'Leak detection and drain cleaning. Fast response in Tuek Thla.', years: 5, area: 'TUEK_THLA', status: 'APPROVED', services: ['plLeak', 'plDrain', 'plToilet'], cert: 'Water Supply Technician Course, PPWSA', idNo: '192021224', demo: false, joinedDaysAgo: 44, skill: 0.8 },
  { key: 'kunthea', phone: '+85512000220', name: 'Kunthea Rin', bio: 'Faucets, sinks and water pumps. Neat silicone work.', years: 4, area: 'PP_SS_OU_BAEK_KAAM', status: 'APPROVED', services: ['plFaucet', 'plPump', 'plLeak'], cert: 'Plumbing Basics, Don Bosco Technical School', idNo: '202122235', demo: false, joinedDaysAgo: 33, skill: 0.78 },
  { key: 'vichea', phone: '+85512000213', name: 'Vichea Sam', bio: 'Applied this week. AC cleaning and lighting.', years: 2, area: 'TUEK_THLA', status: 'PENDING', services: ['acClean', 'elLight'], cert: 'AC Cleaning Course (2024)', idNo: '131415168', demo: false, joinedDaysAgo: 2, skill: 0.6 },
  { key: 'bopha', phone: '+85512000204', name: 'Bopha Nuon', bio: 'New to FixNow. 3 years at an AC shop in Toul Kork.', years: 3, area: 'PHNOM_PENH_THMEI', status: 'PENDING', services: ['acClean', 'acRepair'], cert: 'AC Technician Short Course (2022)', idNo: '040506078', demo: true, joinedDaysAgo: 1, skill: 0.7 },
  { key: 'vuthy', phone: '+85512000214', name: 'Vuthy Heng', bio: 'Electrician.', years: 1, area: 'PHNOM_PENH_THMEI', status: 'REJECTED', services: ['elOutlet'], cert: 'None provided', idNo: '141516179', demo: false, reason: 'ID card photo unreadable and no certificate provided. Please re-upload.', joinedDaysAgo: 9, skill: 0.5 },
  { key: 'kosal', phone: '+85512000205', name: 'Kosal Meas', bio: 'Electrician.', years: 2, area: 'TUEK_THLA', status: 'SUSPENDED', services: ['elWiring'], cert: 'None provided', idNo: '050607089', demo: true, reason: 'Repeated no-shows (demo data)', joinedDaysAgo: 35, skill: 0.4 },
];

// ---------------------------------------------------------------- seed

export async function seedDemo(q: Q, opts: { adminPasswordHash: string; makeDocument: (label: string) => Promise<string> }) {
  const one = async (sql: string, params: unknown[] = []) => (await q(sql, params)).rows[0];
  const now = Date.now();

  // admins
  const admin = (await one(`INSERT INTO users (phone_e164, name, role, password_hash, is_demo_account, created_at) VALUES ($1,$2,'ADMIN',$3,true,$4) RETURNING id`,
    [DEMO_ADMIN.phone, DEMO_ADMIN.name, opts.adminPasswordHash, iso(now - 90 * DAY)])).id as string;
  const finance = (await one(`INSERT INTO users (phone_e164, name, role, password_hash, is_demo_account, created_at) VALUES ($1,$2,'ADMIN',$3,true,$4) RETURNING id`,
    [DEMO_FINANCE_ADMIN.phone, DEMO_FINANCE_ADMIN.name, opts.adminPasswordHash, iso(now - 90 * DAY)])).id as string;

  const audit = (actor: string, action: string, entityType: string, entityId: string, before: unknown, after: unknown, at: number) =>
    q(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, before_json, after_json, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [actor, action, entityType, entityId, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after), iso(at)]);
  const notify = (userId: string, type: string, params: Record<string, unknown>, bookingId: string | null, at: number, read: boolean) =>
    q(`INSERT INTO notifications (user_id, type, booking_id, params, read_at, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, type, bookingId, JSON.stringify(params), read ? iso(at + 30 * MIN) : null, iso(at)]);

  // settings (rate history: launched at 18%, reduced to 15% for the pilot)
  await q(`INSERT INTO app_settings (key, value_json, updated_by, updated_at) VALUES
    ('commission_rate', '15', $1, $2), ('demo_payment_label', '"DEMO – simulated payment"', $1, $2),
    ('warranty_days', '3', NULL, $2), ('booking_response_seconds', '300', NULL, $2)`, [finance, iso(now - 28 * DAY)]);
  await audit(finance, 'SETTING_UPDATED', 'app_setting', 'commission_rate', 18, 15, now - 28 * DAY);

  // catalogue
  const catId: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    catId[c.code] = (await one(`INSERT INTO service_categories (code, name_en, name_km, icon, status, sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [c.code, c.en, c.km, c.icon, c.status, i + 1])).id;
  }
  const svc: Record<string, { id: string; min: string; max: string; en: string; km: string }> = {};
  for (const s of SERVICES) {
    const [key, cat, en, km, dEn, dKm, min, max] = s;
    const status = (s as readonly string[])[8] ?? 'ACTIVE';
    svc[key] = { id: (await one(`INSERT INTO services (category_id, name_en, name_km, description_en, description_km, min_price, max_price, status, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [catId[cat], en, km, dEn, dKm, min, max, status, iso(now - 80 * DAY)])).id, min, max, en, km };
  }
  await audit(admin, 'SERVICE_CREATED', 'service', svc.elSafety.id, null, { nameEn: 'Electrical Safety Inspection', minPrice: '15.00', maxPrice: '30.00' }, now - 20 * DAY);
  await audit(admin, 'SERVICE_UPDATED', 'service', svc.acClean.id, { maxPrice: '25.00' }, { maxPrice: '30.00' }, now - 15 * DAY);

  // customers
  const cust: Record<string, { id: string; area: Area; address: string; lat: number; lng: number; name: string }> = {};
  for (const [i, [key, phone, name, lang, area, address, demo]] of CUSTOMERS.entries()) {
    const lat = Math.round((AREAS[area].lat + between(-0.006, 0.006)) * 1e6) / 1e6;
    const lng = Math.round((AREAS[area].lng + between(-0.006, 0.006)) * 1e6) / 1e6;
    const id = (await one(`INSERT INTO users (phone_e164, name, role, preferred_language, is_demo_account, created_at) VALUES ($1,$2,'CUSTOMER',$3,true,$4) RETURNING id`,
      [phone, name, lang, iso(now - (70 - i * 4) * DAY)])).id;
    void demo;
    await q(`INSERT INTO customer_profiles (user_id, home_address_text, home_area, home_lat, home_lng) VALUES ($1,$2,$3,$4,$5)`, [id, address, area, lat, lng]);
    cust[key] = { id, area, address, lat, lng, name };
  }

  // technicians
  const tech: Record<string, TechSpec & { id: string; userId: string }> = {};
  for (const t of TECHS) {
    const created = now - t.joinedDaysAgo * DAY;
    const uid = (await one(`INSERT INTO users (phone_e164, name, role, is_demo_account, created_at) VALUES ($1,$2,'TECHNICIAN',true,$3) RETURNING id`,
      [t.phone, t.name, iso(created)])).id;
    const idKey = await opts.makeDocument(`DEMO ID ${t.idNo} ${t.name}`);
    const certKey = t.cert === 'None provided' ? null : await opts.makeDocument(`DEMO CERT ${t.name}`);
    const reviewed = t.status === 'PENDING' ? null : created + 20 * HOUR;
    const area = AREAS[t.area];
    const tid = (await one(
      `INSERT INTO technician_profiles (user_id, bio, years_experience, service_area, base_lat, base_lng, status, is_available,
         id_document_key, id_document_number, certificate_key, certificate_summary, rejection_reason, reviewed_by, reviewed_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [uid, t.bio, t.years, t.area, area.lat + between(-0.004, 0.004), area.lng + between(-0.004, 0.004), t.status, t.available ?? true,
        idKey, t.idNo, certKey, t.cert, t.reason ?? null, reviewed ? admin : null, reviewed ? iso(reviewed) : null, iso(created)],
    )).id as string;
    for (const s of t.services) await q(`INSERT INTO technician_services VALUES ($1, $2)`, [tid, svc[s].id]);
    for (const [key, purpose] of [[idKey, 'ID_DOCUMENT'], [certKey, 'CERTIFICATE']] as const) {
      if (key) await q(`INSERT INTO booking_media (uploaded_by, media_type, mime_type, size_bytes, storage_key, purpose, created_at) VALUES ($1,'PHOTO','image/png',1,$2,$3,$4)`, [uid, key, purpose, iso(created)]);
    }
    if (t.status !== 'PENDING') {
      await audit(admin, 'TECHNICIAN_APPROVED', 'technician_profile', tid, { status: 'PENDING' }, { status: 'APPROVED', reason: null }, reviewed!);
      await notify(uid, 'TECHNICIAN_APPROVED', { reason: null }, null, reviewed!, true);
    }
    if (t.status === 'REJECTED') {
      await q(`UPDATE technician_profiles SET status = 'REJECTED' WHERE id = $1`, [tid]);
      await audit(admin, 'TECHNICIAN_REJECTED', 'technician_profile', tid, { status: 'PENDING' }, { status: 'REJECTED', reason: t.reason }, reviewed! + HOUR);
    }
    if (t.status === 'SUSPENDED') {
      await audit(admin, 'TECHNICIAN_SUSPENDED', 'technician_profile', tid, { status: 'APPROVED' }, { status: 'SUSPENDED', reason: t.reason }, now - 6 * DAY);
      await notify(uid, 'TECHNICIAN_SUSPENDED', { reason: t.reason }, null, now - 6 * DAY, true);
    }
    tech[t.key] = { ...t, id: tid, userId: uid };
  }
  const approved = TECHS.filter((t) => t.status === 'APPROVED' || t.status === 'SUSPENDED').map((t) => tech[t.key]);

  // ---------------------------------------------------------------- bookings
  type Status = 'REQUESTED' | 'ACCEPTED' | 'CONFIRMED' | 'FINISHED' | 'PAID' | 'RATED' | 'CLOSED' | 'EXPIRED' | 'DECLINED' | 'CANCELLED' | 'CUSTOMER_NOT_AVAILABLE' | 'DISPUTED' | 'REFUNDED';
  interface Plan {
    customer: CustomerKey; tech: string; service: ServiceKey; extra?: ServiceKey[]; status: Status; createdAt: number; scheduledAt?: number;
    amount?: string; score?: number; payout?: 'PAID' | 'PROCESSING' | 'PENDING' | 'FAILED'; comment?: string; problem?: string;
  }
  const plans: Plan[] = [];
  const paidPlans: Array<{ plan: Plan; bookingId: string; paymentId: string; paidAt: number; code: string }> = [];

  const amountFor = (keys: ServiceKey[]) => {
    const lo = keys.reduce((a, k) => a + Number(svc[k].min), 0), hi = keys.reduce((a, k) => a + Number(svc[k].max), 0);
    const v = lo + (hi - lo) * Math.pow(rnd(), 1.4);
    return (Math.round(v * 2) / 2).toFixed(2);
  };
  const techFor = (key: ServiceKey, area: Area) => {
    const c = AREAS[area];
    const offering = approved.filter((t) => t.status === 'APPROVED' && t.services.includes(key)
      && distanceKm(c.lat, c.lng, AREAS[t.area].lat, AREAS[t.area].lng) <= MAX_TECHNICIAN_DISTANCE_KM);
    if (!offering.length) return null;
    const local = offering.filter((t) => t.area === area);
    return (local.length && rnd() < 0.75 ? pick(local) : pick(offering)).key;
  };
  const scoreFor = (skill: number) => {
    const r = rnd() + (skill - 0.75);
    return r > 0.55 ? 5 : r > 0.2 ? 4 : r > 0.05 ? 3 : 2;
  };
  const activeKeys = SERVICES.filter((s) => (s as readonly string[])[8] === undefined).map((s) => s[0]) as ServiceKey[];

  // 1) History: past 30 days, weighted toward AC (hot season) and recent growth.
  let disputed = 0, refunded = 0;
  for (let d = 30; d >= 1; d--) {
    const count = Math.round(between(1, 3) + (30 - d) / 12);
    for (let k = 0; k < count; k++) {
      const customer = pick(CUSTOMERS.slice(3))[0];
      const r = rnd();
      const prefix = r < 0.5 ? 'ac' : r < 0.8 ? 'el' : 'pl';
      const service = pick(activeKeys.filter((s) => s.startsWith(prefix)));
      const t = techFor(service, cust[customer].area);
      if (!t) continue; // nobody nearby offers it
      let status = weighted<Status>(d >= 3
        ? { RATED: 52, CLOSED: 8, PAID: 6, EXPIRED: 9, DECLINED: 5, CANCELLED: 8, CUSTOMER_NOT_AVAILABLE: 3, DISPUTED: 2, REFUNDED: 2 } as Record<Status, number>
        : { RATED: 35, PAID: 30, EXPIRED: 10, CANCELLED: 10, DECLINED: 5 } as Record<Status, number>);
      if (status === 'DISPUTED' && ++disputed > 2) status = 'RATED';
      if (status === 'REFUNDED' && ++refunded > 2) status = 'RATED';
      if (t === 'kosal') continue;
      // ~20% of visits combine a second service the same technician offers (e.g. cleaning + gas refill)
      const companions = tech[t].services.filter((x) => x !== service && x.slice(0, 2) === service.slice(0, 2));
      const extra = companions.length && rnd() < 0.2 ? [pick(companions)] : undefined;
      plans.push({ customer, tech: t, service, extra, status, createdAt: now - d * DAY - between(7, 19) * HOUR });
    }
  }
  // Kosal's history before suspension (a no-show and a poor rating)
  plans.push({ customer: 'chenda', tech: 'kosal', service: 'elWiring', status: 'CUSTOMER_NOT_AVAILABLE', createdAt: now - 12 * DAY });
  plans.push({ customer: 'pisey', tech: 'kosal', service: 'elWiring', status: 'RATED', score: 2, comment: 'Arrived 2 hours late and left before finishing.', createdAt: now - 9 * DAY });

  // 2) Hand-crafted stories for the demo accounts.
  plans.push(
    { customer: 'vibol', tech: 'rachana', service: 'acClean', status: 'RATED', score: 5, comment: 'Fast and tidy, cleaned all 4 guesthouse units.', amount: '28.00', payout: 'PAID', createdAt: now - 14 * DAY },
    { customer: 'vibol', tech: 'rachana', service: 'elLight', status: 'RATED', score: 4, amount: '24.00', payout: 'PAID', createdAt: now - 6 * DAY },
    { customer: 'sophie', tech: 'channa', service: 'acRepair', extra: ['acGas'], status: 'RATED', score: 5, comment: 'Explained everything in English. Great!', amount: '68.00', payout: 'PROCESSING', createdAt: now - 5 * DAY },
    { customer: 'sophie', tech: 'channa', service: 'acClean', status: 'ACCEPTED', createdAt: now - 4 * HOUR, scheduledAt: now + 28 * HOUR },
  );
  // Demo pairs: every booking below involves a demo customer AND a demo technician,
  // so the same booking can be opened from both apps (and in the admin dashboard).
  plans.push(
    // Sokha <-> Vannak (AC): history, paid job inside the warranty window, upcoming visit tomorrow
    { customer: 'sokha', tech: 'vannak', service: 'acClean', status: 'RATED', score: 5, comment: 'Very clean work, explained everything.', amount: '25.00', payout: 'PAID', createdAt: now - 21 * DAY },
    { customer: 'sokha', tech: 'vannak', service: 'acGas', status: 'PAID', amount: '35.00', payout: 'PENDING', createdAt: now - 1 * DAY - 5 * HOUR },
    { customer: 'sokha', tech: 'vannak', service: 'acMaint', extra: ['acClean'], status: 'ACCEPTED', createdAt: now - 3 * HOUR, scheduledAt: now + 20 * HOUR },
    // Sokha <-> Sophea (electrical): job finished, waiting for Sokha to pay $18
    { customer: 'sokha', tech: 'sophea', service: 'elLight', status: 'RATED', score: 4, comment: 'Good job, arrived 15 minutes late.', amount: '22.50', payout: 'PAID', createdAt: now - 11 * DAY },
    { customer: 'sokha', tech: 'sophea', service: 'elOutlet', status: 'FINISHED', amount: '18.00', createdAt: now - 6 * HOUR },
    // Sokha <-> Piseth (plumbing): rated toilet repair
    { customer: 'sokha', tech: 'piseth', service: 'plToilet', status: 'RATED', score: 5, comment: 'Fixed the running toilet in 20 minutes. Very polite.', amount: '15.00', payout: 'PAID', createdAt: now - 7 * DAY },
    // Dara <-> Sophea (electrical): job IN PROGRESS now; Sophea can finish it, then Dara pays
    { customer: 'dara', tech: 'sophea', service: 'elBreaker', status: 'RATED', score: 4, comment: 'ធ្វើការល្អ ប៉ុន្តែមកយឺតបន្តិច។', amount: '30.00', payout: 'PAID', createdAt: now - 18 * DAY },
    { customer: 'dara', tech: 'sophea', service: 'elWiring', status: 'CONFIRMED', createdAt: now - 2 * HOUR, scheduledAt: now - 30 * MIN },
    // Dara <-> Rithy (AC): history + an expired request (plus a LIVE request below)
    { customer: 'dara', tech: 'rithy', service: 'acRepair', status: 'RATED', score: 5, comment: 'ជាងមកដល់ទាន់ពេល ធ្វើការស្អាត។ អរគុណច្រើន!', amount: '40.00', payout: 'PAID', createdAt: now - 10 * DAY },
    { customer: 'dara', tech: 'rithy', service: 'elOutlet', status: 'EXPIRED', createdAt: now - 3 * DAY },
    // Malis <-> Vannak (AC) and Malis <-> Piseth (plumbing): history (plus LIVE requests below)
    { customer: 'malis', tech: 'vannak', service: 'acRepair', extra: ['acGas'], status: 'RATED', score: 5, comment: 'Repair and gas refill in one visit. AC is cold again!', amount: '72.00', payout: 'PROCESSING', createdAt: now - 4 * DAY },
    { customer: 'malis', tech: 'piseth', service: 'plDrain', status: 'RATED', score: 5, comment: 'Shower drain flows like new.', amount: '20.00', payout: 'PAID', createdAt: now - 9 * DAY },
    { customer: 'malis', tech: 'dararith', service: 'elSafety', status: 'RATED', score: 5, comment: 'Thorough check, gave me a written list of issues.', amount: '25.00', payout: 'PAID', createdAt: now - 16 * DAY },
    // Other customers so every technician dashboard has work
    { customer: 'rotha', tech: 'vannak', service: 'acInstall', status: 'CONFIRMED', createdAt: now - 4 * HOUR, scheduledAt: now - 1 * HOUR },
    { customer: 'kanha', tech: 'rithy', service: 'elLight', status: 'ACCEPTED', createdAt: now - 5 * HOUR, scheduledAt: now + 26 * HOUR },
    { customer: 'kanha', tech: 'piseth', service: 'plFaucet', status: 'ACCEPTED', createdAt: now - 2 * HOUR, scheduledAt: now + 22 * HOUR },
    { customer: 'pisey', tech: 'piseth', service: 'plPump', status: 'PAID', amount: '45.00', payout: 'PENDING', createdAt: now - 1 * DAY - 8 * HOUR },
    { customer: 'david', tech: 'narin', service: 'elHeater', status: 'FINISHED', amount: '32.00', createdAt: now - 7 * HOUR },
    { customer: 'lina', tech: 'sovann', service: 'acMove', status: 'ACCEPTED', createdAt: now - 20 * HOUR, scheduledAt: now + 44 * HOUR },
    { customer: 'sreynich', tech: 'sreymom', service: 'acInstall', status: 'PAID', amount: '65.00', payout: 'PENDING', createdAt: now - 2 * DAY },
    { customer: 'mony', tech: 'dararith', service: 'elFan', status: 'PAID', amount: '20.00', payout: 'PENDING', createdAt: now - 1 * DAY - 2 * HOUR },
    { customer: 'bunthoeun', tech: 'kimsour', service: 'acRepair', status: 'RATED', score: 4, amount: '45.00', payout: 'PENDING', createdAt: now - 2 * DAY - 4 * HOUR },
    { customer: 'chenda', tech: 'sambath', service: 'plLeak', status: 'RATED', score: 4, comment: 'Found the leak quickly.', amount: '28.00', payout: 'PROCESSING', createdAt: now - 3 * DAY },
  );

  plans.sort((a, b) => a.createdAt - b.createdAt);

  const payoutStats = { failedUsed: false };
  for (const p of plans) {
    const c = cust[p.customer];
    const tt = tech[p.tech];
    const key = p.service;
    const keys: ServiceKey[] = [key, ...(p.extra ?? [])];
    const created = p.createdAt;
    const deadline = created + 5 * MIN;
    const scheduled = p.scheduledAt ?? (rnd() < 0.4 ? created + 30 * MIN : created + between(2, 26) * HOUR);
    const reached = (s: Status) => ['ACCEPTED', 'CONFIRMED', 'FINISHED', 'PAID', 'RATED', 'CLOSED', 'CUSTOMER_NOT_AVAILABLE', 'DISPUTED', 'REFUNDED'].includes(s);
    const accepted = reached(p.status) ? created + between(0.5, 4) * MIN : null;
    const started = ['CONFIRMED', 'FINISHED', 'PAID', 'RATED', 'CLOSED', 'DISPUTED', 'REFUNDED'].includes(p.status) ? Math.min(scheduled + between(5, 40) * MIN, now - 20 * MIN) : null;
    const finished = ['FINISHED', 'PAID', 'RATED', 'CLOSED', 'DISPUTED', 'REFUNDED'].includes(p.status) ? Math.min(started! + between(40, 150) * MIN, now - 10 * MIN) : null;
    const paid = ['PAID', 'RATED', 'CLOSED', 'DISPUTED', 'REFUNDED'].includes(p.status) ? Math.min(finished! + between(10, 90) * MIN, now - 5 * MIN) : null;
    const amount = finished ? (p.amount ?? amountFor(keys)) : null;
    const dbStatus = p.status === 'REFUNDED' ? 'REFUNDED' : p.status;
    const problem = p.problem ?? pick(PROBLEMS[key] ?? ['Please check and fix.']);

    const b = await one(
      `INSERT INTO bookings (customer_id, technician_id, service_id, problem_description, scheduled_at, service_area, service_address_text, service_lat, service_lng,
          status, final_amount, response_deadline_at, accepted_at, declined_at, expired_at, started_at, finished_at, paid_at, cancelled_at, cancel_reason, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text::booking_status,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING id, booking_code`,
      [c.id, tt.id, svc[key].id, problem, iso(scheduled), c.area, c.address, c.lat, c.lng, dbStatus, amount, iso(deadline),
        accepted ? iso(accepted) : null,
        p.status === 'DECLINED' ? iso(created + between(1, 3) * MIN) : null,
        p.status === 'EXPIRED' ? iso(deadline) : null,
        started ? iso(started) : null, finished ? iso(finished) : null, paid ? iso(paid) : null,
        p.status === 'CANCELLED' ? iso(created + between(2, 60) * MIN) : null,
        p.status === 'CANCELLED' ? pick(CANCEL_REASONS) : null,
        iso(created), iso(paid ?? finished ?? started ?? accepted ?? created)],
    );
    for (const [pos, extraKey] of (p.extra ?? []).entries()) {
      await q(`INSERT INTO booking_services (booking_id, service_id, position) VALUES ($1,$2,$3)`, [b.id, svc[extraKey].id, pos + 1]);
    }
    const facts = {
      bookingCode: b.booking_code, serviceEn: keys.map((k) => svc[k].en).join(' + '), serviceKm: keys.map((k) => svc[k].km).join(' + '), area: c.area, amount,
    };

    if (amount) {
      const split = splitCommission(amount, '15');
      const paymentStatus = p.status === 'FINISHED' ? 'PENDING' : p.status === 'REFUNDED' ? 'REFUNDED' : 'PAID';
      const confirmer = rnd() < 0.7 ? finance : admin;
      const payment = await one(
        `INSERT INTO payments (booking_id, provider, provider_reference, qr_payload, amount, status, commission_rate, commission_amount, technician_net,
            confirmed_by, confirmed_at, refunded_by, refunded_at, refund_reason, is_demo, created_at)
         VALUES ($1,'DEMO_QR',$2,$3,$4,$5::text::payment_status,$6,$7,$8,$9,$10,$11,$12,$13,true,$14) RETURNING id`,
        [b.id, paid ? `DEMO-CONFIRM-${Math.floor(paid / 1000)}` : null,
          `FIXNOW-DEMO-QR|ref=${b.booking_code}|seed|amt=${split.amount}|cur=USD`, split.amount, paymentStatus,
          split.commissionRate, split.commissionAmount, split.technicianNet,
          paid ? confirmer : null, paid ? iso(paid) : null,
          p.status === 'REFUNDED' ? admin : null, p.status === 'REFUNDED' ? iso(paid! + 1 * DAY) : null,
          p.status === 'REFUNDED' ? 'Job not completed to standard; customer complaint upheld' : null, iso(finished!)],
      );
      if (paid) {
        await audit(confirmer, 'PAYMENT_CONFIRMED_DEMO', 'payment', payment.id, { status: 'PENDING' },
          { status: 'PAID', simulated: true, amount: split.amount, commission: split.commissionAmount, technicianNet: split.technicianNet }, paid);
        const ageDays = (now - paid) / DAY;
        let payoutStatus = p.payout ?? (ageDays > 7 ? 'PAID' : ageDays > 3 ? 'PROCESSING' : 'PENDING');
        if (!p.payout && !payoutStats.failedUsed && ageDays > 4 && ageDays < 8 && p.status === 'RATED') { payoutStatus = 'FAILED'; payoutStats.failedUsed = true; }
        if (p.status === 'REFUNDED') payoutStatus = 'FAILED';
        const payoutPaidAt = payoutStatus === 'PAID' ? paid + between(2, 6) * DAY : null;
        const ref = payoutStatus === 'PAID' ? `ABA-TRX-${String(Math.floor(rnd() * 1e8)).padStart(8, '0')}`
          : p.status === 'REFUNDED' ? 'Cancelled: payment refunded' : payoutStatus === 'FAILED' ? 'Bank rejected: account name mismatch' : null;
        const payout = await one(
          `INSERT INTO payouts (technician_id, payment_id, amount, status, method, reference, paid_at, created_at, updated_at)
           VALUES ($1,$2,$3,$4::text::payout_status,'BANK_TRANSFER',$5,$6,$7,$8) RETURNING id`,
          [tt.id, payment.id, split.technicianNet, payoutStatus, ref, payoutPaidAt ? iso(Math.min(payoutPaidAt, now - HOUR)) : null, iso(paid), iso(payoutPaidAt ? Math.min(payoutPaidAt, now - HOUR) : paid)],
        );
        await audit(confirmer, 'PAYOUT_CREATED', 'payout', payout.id, null, { status: 'PENDING', amount: split.technicianNet }, paid);
        if (payoutStatus === 'PAID') await audit(finance, 'PAYOUT_PAID', 'payout', payout.id, { status: 'PROCESSING' }, { status: 'PAID', reference: ref, recordOnly: true }, Math.min(payoutPaidAt!, now - HOUR));
        if (p.status === 'REFUNDED') await audit(admin, 'PAYMENT_REFUNDED', 'payment', payment.id, { status: 'PAID' }, { status: 'REFUNDED', reason: 'Job not completed to standard; customer complaint upheld', simulated: true }, paid + DAY);
        paidPlans.push({ plan: p, bookingId: b.id, paymentId: payment.id, paidAt: paid, code: b.booking_code });

        // ratings
        if (p.status === 'RATED' || p.status === 'CLOSED') {
          const score = p.score ?? scoreFor(tt.skill);
          const comment = p.comment ?? (rnd() < 0.75 ? pick(COMMENTS[score]) : null);
          await q(`INSERT INTO ratings (booking_id, customer_id, technician_id, score, comment, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
            [b.id, c.id, tt.id, score, comment, iso(Math.min(paid + between(10, 300) * MIN, now - 2 * MIN))]);
          if (now - paid < 10 * DAY) await notify(tt.userId, 'RATING_RECEIVED', { ...facts, score }, b.id, Math.min(paid + HOUR, now - MIN), now - paid > DAY);
        }
        if (p.status === 'DISPUTED') {
          await audit(admin, 'BOOKING_DISPUTED', 'booking', b.id, { status: 'PAID' }, { status: 'DISPUTED', reason: 'Customer reports the fault returned the next day' }, paid + 20 * HOUR);
        }
        if (p.status === 'CLOSED') await audit(admin, 'BOOKING_CLOSED', 'booking', b.id, { status: 'RATED' }, { status: 'CLOSED', reason: null }, paid + 3 * DAY);
        if (now - paid < 10 * DAY) {
          await notify(c.id, 'PAYMENT_CONFIRMED', facts, b.id, paid, now - paid > DAY);
          await notify(tt.userId, 'PAYMENT_CONFIRMED_TECH', facts, b.id, paid, now - paid > DAY);
        }
      }
      if (p.status === 'FINISHED') await notify(c.id, 'BOOKING_FINISHED', facts, b.id, finished!, false);
    }
    // timeline notifications for the most recent events
    if (now - created < 2 * DAY) {
      if (accepted) await notify(c.id, 'BOOKING_ACCEPTED', facts, b.id, accepted, now - accepted > 2 * HOUR);
      if (started && p.status === 'CONFIRMED') await notify(c.id, 'BOOKING_STARTED', facts, b.id, started, false);
      if (p.status === 'EXPIRED') {
        await notify(c.id, 'BOOKING_EXPIRED', facts, b.id, deadline, true);
        await notify(tt.userId, 'BOOKING_EXPIRED_TECH', facts, b.id, deadline, true);
      }
    }
    if (p.status === 'EXPIRED' && p.customer === 'dara') await notify(c.id, 'BOOKING_EXPIRED', facts, b.id, deadline, true);
  }

  // 3) Live requests right now (5-minute countdowns running when the demo starts).
  const live: Array<[CustomerKey, string, ServiceKey, string, number, ServiceKey[]?]> = [
    ['malis', 'vannak', 'acRepair', 'AC in the master bedroom is leaking water onto the bed. Probably also needs gas.', 10_000, ['acGas']],
    ['dara', 'rithy', 'acClean', 'Please clean 2 wall units before my family visits.', 20_000],
    ['malis', 'piseth', 'plLeak', 'Kitchen sink pipe is leaking under the cabinet.', 30_000],
  ];
  for (const [ck, tk, sk, problem, ageMs, extra] of live) {
    const c = cust[ck];
    const created = now - ageMs;
    const b = await one(
      `INSERT INTO bookings (customer_id, technician_id, service_id, problem_description, scheduled_at, service_area, service_address_text, service_lat, service_lng,
          status, response_deadline_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'REQUESTED', now() + make_interval(secs => $10), now() - make_interval(secs => $11), now() - make_interval(secs => $11))
       RETURNING id, booking_code`,
      [c.id, tech[tk].id, svc[sk].id, problem, iso(created + 30 * MIN), c.area, c.address, c.lat, c.lng, 300 - ageMs / 1000, ageMs / 1000],
    );
    for (const [pos, ek] of (extra ?? []).entries()) {
      await q(`INSERT INTO booking_services (booking_id, service_id, position) VALUES ($1,$2,$3)`, [b.id, svc[ek].id, pos + 1]);
    }
    const keys = [sk, ...(extra ?? [])];
    await notify(tech[tk].userId, 'BOOKING_REQUESTED', {
      bookingCode: b.booking_code, serviceEn: keys.map((k) => svc[k].en).join(' + '), serviceKm: keys.map((k) => svc[k].km).join(' + '), area: c.area,
    }, b.id, created, false);
  }

  // 4) Warranty claims (on jobs paid within the 3-day window).
  const recentPaid = paidPlans.filter((x) => now - x.paidAt < 2.5 * DAY && ['PAID', 'RATED'].includes(x.plan.status) && x.plan.customer !== 'sokha');
  const warrantyPlans: Array<[string, string, string | null]> = [
    ['OPEN', 'Water is dripping from the indoor unit again since this morning.', null],
    ['ACCEPTED', 'Fan works but the light switch is loose after the install.', 'Technician will return tomorrow 9:00.'],
    ['RESOLVED', 'AC was making a clicking noise after the gas refill.', 'Tightened the outdoor fan mount. Fixed on site.'],
  ];
  for (const [i, [status, description, note]] of warrantyPlans.entries()) {
    const x = recentPaid[i];
    if (!x) break;
    const created = Math.min(x.paidAt + between(3, 20) * HOUR, now - 30 * MIN);
    const w = await one(
      `INSERT INTO warranty_requests (booking_id, customer_id, technician_id, description, status, resolution_note, created_at, resolved_at)
       VALUES ($1,$2,$3,$4,$5::text::warranty_status,$6,$7,$8) RETURNING id`,
      [x.bookingId, cust[x.plan.customer].id, tech[x.plan.tech].id, description, status, note, iso(created), status === 'RESOLVED' ? iso(Math.min(created + 5 * HOUR, now - 5 * MIN)) : null],
    );
    const facts = { bookingCode: x.code, serviceEn: svc[x.plan.service].en, serviceKm: svc[x.plan.service].km };
    await notify(tech[x.plan.tech].userId, 'WARRANTY_REQUESTED', facts, x.bookingId, created, status !== 'OPEN');
    if (status !== 'OPEN') await notify(cust[x.plan.customer].id, 'WARRANTY_UPDATED', { ...facts, status }, x.bookingId, created + HOUR, false);
    void w;
  }

  // 5) Support tickets and disputes.
  const disputedBooking = (await one(`SELECT id, customer_id FROM bookings WHERE status = 'DISPUTED' ORDER BY created_at DESC LIMIT 1`));
  const refundedBooking = (await one(`SELECT id, customer_id FROM bookings WHERE status = 'REFUNDED' ORDER BY created_at DESC LIMIT 1`));
  const tickets: Array<[string, string | null, string, string, string, string | null, number]> = [
    [tech.sophea.userId, null, 'PAYMENT', 'When will I receive my payout for last week?', 'OPEN', null, 1],
    [cust.pisey.id, null, 'ACCOUNT', 'How do I change my home address? I moved to Tuek Thla.', 'RESOLVED', 'You can edit it in Profile → Home location. We updated it for you.', 6],
    [cust.david.id, null, 'GENERAL', 'Do you plan to offer plumbing soon? My sink is leaking.', 'IN_REVIEW', 'Plumbing launches after the pilot. We will notify you.', 3],
    [tech.kimsour.userId, null, 'ACCOUNT', 'I want to add AC Installation to my services.', 'OPEN', null, 2],
    [cust.chenda.id, null, 'SAFETY', 'Technician did not wear any ID badge. Is this normal?', 'CLOSED', 'All technicians are verified; we reminded the technician to show his FixNow profile on arrival.', 12],
  ];
  if (disputedBooking) tickets.push([disputedBooking.customer_id, disputedBooking.id, 'DISPUTE', 'The AC stopped cooling again the next day. I want the technician to come back or a refund.', 'IN_REVIEW', 'Reviewing with the technician. Booking marked as disputed.', 4]);
  if (refundedBooking) tickets.push([refundedBooking.customer_id, refundedBooking.id, 'QUALITY', 'The job was left half done and the technician did not answer.', 'RESOLVED', 'Refund recorded (demo). Technician received a warning.', 8]);
  for (const [i, [by, bookingId, category, description, status, note, daysAgo]] of tickets.entries()) {
    const created = now - daysAgo * DAY + i * MIN;
    const t = await one(
      `INSERT INTO support_tickets (ticket_code, created_by, booking_id, category, description, status, admin_note, assigned_admin, created_at, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6::text::ticket_status,$7,$8,$9,$10) RETURNING id, ticket_code`,
      [`T-${String(240101 + i)}`, by, bookingId, category, description, status, note, note ? admin : null, iso(created),
        ['RESOLVED', 'CLOSED'].includes(status) ? iso(created + 6 * HOUR) : null],
    );
    if (note) {
      await audit(admin, 'TICKET_UPDATED', 'support_ticket', t.id, { status: 'OPEN' }, { status, note }, created + 6 * HOUR);
      await notify(by, 'TICKET_UPDATED', { ticketCode: t.ticket_code, status }, bookingId, created + 6 * HOUR, daysAgo > 3);
    }
  }

  // Featured demo accounts are listed first on the sign-in screen (the others follow by name).
  const FEATURED = ['+85512000101', '+85512000102', '+85512000103', '+85512000201', '+85512000202', '+85512000203', '+85512000218', '+85512000204', '+85512000205'];
  for (const [rank, phone] of FEATURED.entries()) await q(`UPDATE users SET demo_rank = $2 WHERE phone_e164 = $1`, [phone, rank + 1]);

  return {
    admin, sokha: cust.sokha.id, dara: cust.dara.id, vannak: tech.vannak.id, sophea: tech.sophea.id, rithy: tech.rithy.id,
    services: {
      acClean: svc.acClean.id, acRepair: svc.acRepair.id, acGas: svc.acGas.id, acInstall: svc.acInstall.id,
      elWiring: svc.elWiring.id, elOutlet: svc.elOutlet.id, elBreaker: svc.elBreaker.id, elLight: svc.elLight.id,
    },
  };
}
