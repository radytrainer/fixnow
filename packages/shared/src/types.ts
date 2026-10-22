import type {
  BookingStatus, PaymentStatus, PayoutStatus, Role, TechnicianStatus, TicketCategory, TicketStatus, WarrantyStatus,
} from './constants';

export interface ApiError { code: string; message: string; details?: unknown }

export interface Me {
  id: string;
  role: Role;
  name: string | null;
  phone: string; // the user's OWN phone, masked except last 3 digits
  preferredLanguage: 'en' | 'km';
  isDemoAccount: boolean;
  customerProfile?: { homeAddressText: string | null; homeArea: string | null; homeLat: number | null; homeLng: number | null } | null;
  technicianProfile?: OwnTechnicianProfile | null;
}

export interface OwnTechnicianProfile {
  id: string;
  status: TechnicianStatus;
  isAvailable: boolean;
  bio: string | null;
  yearsExperience: number;
  serviceArea: string;
  certificateSummary: string | null;
  idDocumentNumber: string | null;
  hasIdDocument: boolean;
  hasCertificate: boolean;
  photoUrl: string | null;
  rejectionReason: string | null;
  serviceIds: string[];
}

export interface ServiceCategoryDto {
  id: string; code: string; nameEn: string; nameKm: string; icon: string;
  status: 'ACTIVE' | 'COMING_SOON'; sortOrder: number;
  services: ServiceDto[];
}

export interface ServiceDto {
  id: string; categoryId: string; nameEn: string; nameKm: string;
  descriptionEn: string | null; descriptionKm: string | null;
  minPrice: string | null; maxPrice: string | null; status: 'ACTIVE' | 'COMING_SOON';
}

/** Technician as seen by customers. Never includes phone or private documents. */
export interface PublicTechnician {
  id: string; name: string; photoUrl: string | null; bio: string | null; yearsExperience: number;
  serviceArea: string; certificateSummary: string | null; ratingAvg: number | null; ratingCount: number;
  jobsCompleted: number; distanceKm: number | null; serviceIds: string[]; isAvailable: boolean;
}

export interface PaymentDto {
  id: string; status: PaymentStatus; amount: string; currency: string; commissionRate: string;
  commissionAmount: string; technicianNet: string; qrPayload: string | null; isDemo: boolean;
  provider: string; confirmedAt: string | null; refundedAt: string | null; payoutStatus?: PayoutStatus | null;
}

export interface BookingMediaDto { id: string; mediaType: 'PHOTO' | 'VIDEO'; purpose: string; url: string; createdAt: string }

export interface BookingDto {
  id: string; bookingCode: string; status: BookingStatus;
  /** Summary of everything booked: id of the primary service, names joined with " + ", summed price range. */
  service: { id: string; nameEn: string; nameKm: string; minPrice: string | null; maxPrice: string | null };
  /** Each booked service (one visit can cover several, e.g. AC Cleaning + AC Gas Refill). */
  services: Array<{ id: string; nameEn: string; nameKm: string; minPrice: string | null; maxPrice: string | null }>;
  technician: { id: string; name: string; photoUrl: string | null; ratingAvg: number | null };
  /** null for the technician until the booking is accepted */
  customer: { id: string; name: string | null } | null;
  problemDescription: string; scheduledAt: string; serviceArea: string;
  /** null for the technician until the booking is accepted */
  serviceAddressText: string | null; serviceLat: number | null; serviceLng: number | null;
  responseDeadlineAt: string; serverNow: string;
  acceptedAt: string | null; startedAt: string | null; finishedAt: string | null; paidAt: string | null;
  createdAt: string; finalAmount: string | null; cancelReason: string | null;
  payment: PaymentDto | null;
  rating: { score: number; comment: string | null } | null;
  media: BookingMediaDto[];
  warrantyEligibleUntil: string | null;
  warranty: { id: string; status: WarrantyStatus; description: string; createdAt: string } | null;
}

export interface EarningsDto {
  totals: { gross: string; commission: string; net: string; paidOut: string; pendingPayout: string; jobs: number };
  commissionRate: string;
  items: Array<{
    bookingId: string; bookingCode: string; serviceNameEn: string; serviceNameKm: string; paidAt: string | null;
    gross: string; commissionRate: string; commission: string; net: string; payoutStatus: PayoutStatus | null; isDemo: boolean;
  }>;
  payouts: Array<{ id: string; amount: string; status: PayoutStatus; method: string; reference: string | null; paidAt: string | null; createdAt: string }>;
}

export interface SupportTicketDto {
  id: string; ticketCode: string; category: TicketCategory; description: string; status: TicketStatus;
  bookingCode: string | null; adminNote: string | null; createdAt: string; resolvedAt: string | null;
}

export interface Paginated<T> { items: T[]; total: number; page: number; pageSize: number }
