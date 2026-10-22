-- In-app notifications (push fallback). Content is rendered on the client from `type` + `params`
-- so it can be shown in English or Khmer. Params never contain phone numbers or exact addresses.
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  params jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
