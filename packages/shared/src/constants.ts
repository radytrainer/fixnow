export const ROLES = ['CUSTOMER', 'TECHNICIAN', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const TECHNICIAN_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type TechnicianStatus = (typeof TECHNICIAN_STATUSES)[number];

export const BOOKING_STATUSES = [
  'REQUESTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONFIRMED', 'FINISHED', 'PAID', 'RATED',
  'CANCELLED', 'CUSTOMER_NOT_AVAILABLE', 'DISPUTED', 'REFUNDED', 'CLOSED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses after which the technician may see the exact address and customer name. */
export const ADDRESS_VISIBLE_STATUSES: readonly BookingStatus[] = [
  'ACCEPTED', 'CONFIRMED', 'FINISHED', 'PAID', 'RATED', 'CLOSED', 'DISPUTED', 'REFUNDED', 'CUSTOMER_NOT_AVAILABLE',
];

/** Statuses in which a booking is still "open" for the customer (not terminal). */
export const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = ['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'FINISHED'];

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYOUT_STATUSES = ['PENDING', 'PROCESSING', 'PAID', 'FAILED'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const WARRANTY_STATUSES = ['OPEN', 'ACCEPTED', 'REJECTED', 'RESOLVED'] as const;
export type WarrantyStatus = (typeof WARRANTY_STATUSES)[number];

export const TICKET_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = ['GENERAL', 'PAYMENT', 'QUALITY', 'DISPUTE', 'SAFETY', 'ACCOUNT'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

// Service areas live in ./areas (re-exported from the package index).


export const BOOKING_RESPONSE_SECONDS = 5 * 60;
export const WARRANTY_DAYS = 3;
export const DEFAULT_COMMISSION_RATE = 15;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
