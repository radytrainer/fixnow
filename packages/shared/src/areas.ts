/**
 * Service areas across Cambodia.
 * - Phnom Penh: the Sen Sok sangkats (pilot launch area) plus every other khan.
 * - Provinces: one entry per province, centred on the provincial town.
 * Coordinates are approximate centres, used only for "nearest technician" distance.
 * Khmer names are machine-assisted and should be reviewed by a native speaker.
 */
export interface ServiceArea {
  code: string;
  name_en: string;
  name_km: string;
  /** Group heading shown in pickers (province, or "Sen Sok, Phnom Penh"). */
  group_en: string;
  group_km: string;
  lat: number;
  lng: number;
  /** Part of the Sen Sok launch pilot. */
  pilot: boolean;
}

const SEN_SOK = ['Sen Sok, Phnom Penh', 'សែនសុខ, ភ្នំពេញ'] as const;
const PHNOM_PENH = ['Phnom Penh', 'ភ្នំពេញ'] as const;
const PROVINCES = ['Provinces', 'ខេត្ត'] as const;

const a = (code: string, en: string, km: string, group: readonly [string, string], lat: number, lng: number, pilot = false): ServiceArea =>
  ({ code, name_en: en, name_km: km, group_en: group[0], group_km: group[1], lat, lng, pilot });

export const SERVICE_AREAS: readonly ServiceArea[] = [
  // Sen Sok, Phnom Penh: pilot sangkats first
  a('PHNOM_PENH_THMEI', 'Phnom Penh Thmei', 'ភ្នំពេញថ្មី', SEN_SOK, 11.5945, 104.8936, true),
  a('TUEK_THLA', 'Tuek Thla', 'ទឹកថ្លា', SEN_SOK, 11.5733, 104.8761, true),
  a('PP_SS_KHMUONH', 'Khmuonh', 'ឃ្មួញ', SEN_SOK, 11.5850, 104.8680),
  a('PP_SS_KRANG_THNONG', 'Krang Thnong', 'ក្រាំងធ្នង់', SEN_SOK, 11.6100, 104.8400),
  a('PP_SS_OU_BAEK_KAAM', "Ou Baek K'am", 'អូរបែកក្អម', SEN_SOK, 11.5845, 104.8905),
  a('PP_SS_KOUK_KHLEANG', 'Kouk Khleang', 'គោកឃ្លាង', SEN_SOK, 11.6050, 104.8800),
  // Other khans of Phnom Penh
  a('PP_BOENG_KENG_KANG', 'Boeng Keng Kang', 'បឹងកេងកង', PHNOM_PENH, 11.5530, 104.9250),
  a('PP_CHAMKAR_MON', 'Chamkar Mon', 'ចំការមន', PHNOM_PENH, 11.5450, 104.9200),
  a('PP_DOUN_PENH', 'Doun Penh', 'ដូនពេញ', PHNOM_PENH, 11.5700, 104.9200),
  a('PP_PRAMPIR_MAKARA', 'Prampir Makara', '៧មករា', PHNOM_PENH, 11.5630, 104.9100),
  a('PP_TUOL_KOUK', 'Tuol Kouk', 'ទួលគោក', PHNOM_PENH, 11.5780, 104.9000),
  a('PP_RUSSEY_KEO', 'Russey Keo', 'ឫស្សីកែវ', PHNOM_PENH, 11.6100, 104.9050),
  a('PP_MEAN_CHEY', 'Mean Chey', 'មានជ័យ', PHNOM_PENH, 11.5280, 104.9300),
  a('PP_CHBAR_AMPOV', 'Chbar Ampov', 'ច្បារអំពៅ', PHNOM_PENH, 11.5300, 104.9600),
  a('PP_CHROY_CHANGVAR', 'Chroy Changvar', 'ជ្រោយចង្វារ', PHNOM_PENH, 11.5900, 104.9400),
  a('PP_DANGKAO', 'Dangkao', 'ដង្កោ', PHNOM_PENH, 11.4970, 104.8760),
  a('PP_POU_SENCHEY', 'Pou Senchey', 'ពោធិ៍សែនជ័យ', PHNOM_PENH, 11.5450, 104.8330),
  a('PP_PREK_PNOV', 'Prek Pnov', 'ព្រែកព្នៅ', PHNOM_PENH, 11.6800, 104.8500),
  a('PP_KAMBOUL', 'Kamboul', 'កំបូល', PHNOM_PENH, 11.5200, 104.7800),
  // Provinces (provincial town)
  a('PV_BANTEAY_MEANCHEY', 'Banteay Meanchey', 'បន្ទាយមានជ័យ', PROVINCES, 13.5860, 102.9730),
  a('PV_BATTAMBANG', 'Battambang', 'បាត់ដំបង', PROVINCES, 13.0950, 103.2020),
  a('PV_KAMPONG_CHAM', 'Kampong Cham', 'កំពង់ចាម', PROVINCES, 11.9930, 105.4640),
  a('PV_KAMPONG_CHHNANG', 'Kampong Chhnang', 'កំពង់ឆ្នាំង', PROVINCES, 12.2500, 104.6670),
  a('PV_KAMPONG_SPEU', 'Kampong Speu', 'កំពង់ស្ពឺ', PROVINCES, 11.4530, 104.5210),
  a('PV_KAMPONG_THOM', 'Kampong Thom', 'កំពង់ធំ', PROVINCES, 12.7120, 104.8890),
  a('PV_KAMPOT', 'Kampot', 'កំពត', PROVINCES, 10.6100, 104.1810),
  a('PV_KANDAL', 'Kandal (Ta Khmau)', 'កណ្ដាល (តាខ្មៅ)', PROVINCES, 11.4830, 104.9460),
  a('PV_KEP', 'Kep', 'កែប', PROVINCES, 10.4830, 104.3170),
  a('PV_KOH_KONG', 'Koh Kong', 'កោះកុង', PROVINCES, 11.6160, 102.9830),
  a('PV_KRATIE', 'Kratie', 'ក្រចេះ', PROVINCES, 12.4880, 106.0190),
  a('PV_MONDULKIRI', 'Mondulkiri', 'មណ្ឌលគិរី', PROVINCES, 12.4550, 107.1880),
  a('PV_ODDAR_MEANCHEY', 'Oddar Meanchey', 'ឧត្តរមានជ័យ', PROVINCES, 14.1810, 103.5170),
  a('PV_PAILIN', 'Pailin', 'ប៉ៃលិន', PROVINCES, 12.8490, 102.6090),
  a('PV_PREAH_SIHANOUK', 'Preah Sihanouk', 'ព្រះសីហនុ', PROVINCES, 10.6270, 103.5220),
  a('PV_PREAH_VIHEAR', 'Preah Vihear', 'ព្រះវិហារ', PROVINCES, 13.8070, 104.9800),
  a('PV_PREY_VENG', 'Prey Veng', 'ព្រៃវែង', PROVINCES, 11.4840, 105.3250),
  a('PV_PURSAT', 'Pursat', 'ពោធិ៍សាត់', PROVINCES, 12.5380, 103.9190),
  a('PV_RATANAKIRI', 'Ratanakiri', 'រតនគិរី', PROVINCES, 13.7390, 106.9870),
  a('PV_SIEM_REAP', 'Siem Reap', 'សៀមរាប', PROVINCES, 13.3670, 103.8440),
  a('PV_STUNG_TRENG', 'Stung Treng', 'ស្ទឹងត្រែង', PROVINCES, 13.5250, 105.9680),
  a('PV_SVAY_RIENG', 'Svay Rieng', 'ស្វាយរៀង', PROVINCES, 11.0880, 105.7990),
  a('PV_TAKEO', 'Takeo', 'តាកែវ', PROVINCES, 10.9900, 104.7850),
  a('PV_TBONG_KHMUM', 'Tbong Khmum', 'ត្បូងឃ្មុំ', PROVINCES, 11.9120, 105.6550),
];

export const AREA_CODES = SERVICE_AREAS.map((x) => x.code) as [string, ...string[]];
export type ServiceAreaCode = string;

/** Technicians farther than this from the job location are not offered to the customer. */
export const MAX_TECHNICIAN_DISTANCE_KM = 30;

export function findArea(code: string | null | undefined) {
  return SERVICE_AREAS.find((x) => x.code === code) ?? null;
}

/** "Tuol Kouk, Phnom Penh" / "Siem Reap" — short label with its group when helpful. */
export function areaLabel(code: string | null | undefined, lang: 'en' | 'km' = 'en', withGroup = false) {
  const x = findArea(code);
  if (!x) return code ?? '';
  const name = lang === 'km' ? x.name_km : x.name_en;
  if (!withGroup || x.group_en === 'Provinces') return name;
  return `${name}, ${lang === 'km' ? x.group_km : x.group_en}`;
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}
