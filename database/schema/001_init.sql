-- FixNow schema v1 (PostgreSQL). Applied by services/api/src/db/migrate.ts.
-- Money columns use NUMERIC (decimal); all timestamps are timestamptz (UTC).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('CUSTOMER', 'TECHNICIAN', 'ADMIN');
CREATE TYPE technician_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE category_status AS ENUM ('ACTIVE', 'COMING_SOON');
CREATE TYPE booking_status AS ENUM (
  'REQUESTED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONFIRMED', 'FINISHED', 'PAID', 'RATED',
  'CANCELLED', 'CUSTOMER_NOT_AVAILABLE', 'DISPUTED', 'REFUNDED', 'CLOSED'
);
CREATE TYPE media_type AS ENUM ('PHOTO', 'VIDEO');
CREATE TYPE media_purpose AS ENUM ('PROBLEM', 'COMPLETION', 'WARRANTY', 'ID_DOCUMENT', 'CERTIFICATE', 'PROFILE_PHOTO');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
CREATE TYPE payout_status AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');
CREATE TYPE warranty_status AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED', 'RESOLVED');
CREATE TYPE ticket_status AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE CHECK (phone_e164 ~ '^\+855[0-9]{8,9}$'),
  name text,
  role user_role NOT NULL,
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'km')),
  password_hash text,               -- admin accounts only
  auth_provider_id text,
  is_demo_account boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_phone_idx ON otp_codes (phone_e164, created_at DESC);

CREATE TABLE customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  home_address_text text,
  home_area text,
  home_lat numeric(9,6),
  home_lng numeric(9,6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE technician_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio text,
  years_experience int NOT NULL DEFAULT 0 CHECK (years_experience BETWEEN 0 AND 60),
  service_area text NOT NULL,
  base_lat numeric(9,6),
  base_lng numeric(9,6),
  status technician_status NOT NULL DEFAULT 'PENDING',
  is_available boolean NOT NULL DEFAULT true,
  public_photo_key text,            -- private storage key; served via signed URL
  id_document_key text,             -- admin-only
  id_document_number text,          -- admin-only metadata
  certificate_key text,             -- admin-only
  certificate_summary text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz
);

CREATE TABLE service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_km text NOT NULL,
  icon text NOT NULL DEFAULT 'tool',
  status category_status NOT NULL DEFAULT 'COMING_SOON',
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES service_categories(id),
  name_en text NOT NULL,
  name_km text NOT NULL,
  description_en text,
  description_km text,
  min_price numeric(10,2) CHECK (min_price IS NULL OR min_price >= 0),
  max_price numeric(10,2) CHECK (max_price IS NULL OR max_price >= 0),
  status category_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_price IS NULL OR max_price IS NULL OR min_price <= max_price)
);

CREATE TABLE technician_services (
  technician_id uuid NOT NULL REFERENCES technician_profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (technician_id, service_id)
);

CREATE SEQUENCE booking_code_seq START 1001;

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code text NOT NULL UNIQUE DEFAULT ('FN-' || nextval('booking_code_seq')::text),
  customer_id uuid NOT NULL REFERENCES users(id),
  technician_id uuid NOT NULL REFERENCES technician_profiles(id),
  service_id uuid NOT NULL REFERENCES services(id),
  problem_description text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  service_area text NOT NULL,       -- coarse area, visible before acceptance
  service_address_text text NOT NULL,
  service_lat numeric(9,6),
  service_lng numeric(9,6),
  status booking_status NOT NULL DEFAULT 'REQUESTED',
  final_amount numeric(10,2),
  previous_booking_id uuid REFERENCES bookings(id),
  cancel_reason text,
  response_deadline_at timestamptz NOT NULL,
  accepted_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bookings_customer_idx ON bookings (customer_id, created_at DESC);
CREATE INDEX bookings_technician_idx ON bookings (technician_id, created_at DESC);
CREATE INDEX bookings_requested_deadline_idx ON bookings (response_deadline_at) WHERE status = 'REQUESTED';

CREATE TABLE booking_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  warranty_request_id uuid,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  media_type media_type NOT NULL,
  mime_type text NOT NULL,
  size_bytes int NOT NULL,
  storage_key text NOT NULL,
  purpose media_purpose NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_media_booking_idx ON booking_media (booking_id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
  provider text NOT NULL DEFAULT 'DEMO_QR',
  provider_reference text,
  qr_payload text NOT NULL UNIQUE,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  status payment_status NOT NULL DEFAULT 'PENDING',
  commission_rate numeric(5,2) NOT NULL,
  commission_amount numeric(10,2) NOT NULL,
  technician_net numeric(10,2) NOT NULL,
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  refunded_by uuid REFERENCES users(id),
  refunded_at timestamptz,
  refund_reason text,
  is_demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (commission_amount + technician_net = amount)
);

CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES technician_profiles(id),
  payment_id uuid NOT NULL UNIQUE REFERENCES payments(id),
  amount numeric(10,2) NOT NULL,
  status payout_status NOT NULL DEFAULT 'PENDING',
  method text NOT NULL DEFAULT 'BANK_TRANSFER',
  reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
  customer_id uuid NOT NULL REFERENCES users(id),
  technician_id uuid NOT NULL REFERENCES technician_profiles(id),
  score int NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE warranty_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  customer_id uuid NOT NULL REFERENCES users(id),
  technician_id uuid NOT NULL REFERENCES technician_profiles(id),
  description text NOT NULL,
  status warranty_status NOT NULL DEFAULT 'OPEN',
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE booking_media ADD CONSTRAINT booking_media_warranty_fk
  FOREIGN KEY (warranty_request_id) REFERENCES warranty_requests(id) ON DELETE CASCADE;

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code text NOT NULL UNIQUE DEFAULT ('T-' || lpad((floor(random() * 1000000))::int::text, 6, '0')),
  created_by uuid NOT NULL REFERENCES users(id),
  booking_id uuid REFERENCES bookings(id),
  category text NOT NULL CHECK (category IN ('GENERAL', 'PAYMENT', 'QUALITY', 'DISPUTE', 'SAFETY', 'ACCOUNT')),
  description text NOT NULL,
  status ticket_status NOT NULL DEFAULT 'OPEN',
  admin_note text,
  assigned_admin uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE app_settings (
  key text PRIMARY KEY,
  value_json jsonb NOT NULL,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
