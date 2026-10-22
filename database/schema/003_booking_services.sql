-- A booking can cover several services done by the same technician in one visit
-- (e.g. AC Cleaning + AC Gas Refill). bookings.service_id stays as the primary (first) service.
CREATE TABLE booking_services (
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (booking_id, service_id)
);
CREATE INDEX booking_services_service_idx ON booking_services (service_id);

INSERT INTO booking_services (booking_id, service_id, position)
SELECT id, service_id, 0 FROM bookings;

-- One row per booking describing all its services, with the same column names as `services`
-- so existing joins can show "AC Cleaning + AC Gas Refill" and the combined price range.
CREATE VIEW booking_service_summary AS
SELECT bs.booking_id,
       string_agg(s.name_en, ' + ' ORDER BY bs.position) AS name_en,
       string_agg(s.name_km, ' + ' ORDER BY bs.position) AS name_km,
       CASE WHEN bool_and(s.min_price IS NOT NULL) THEN sum(s.min_price) END AS min_price,
       CASE WHEN bool_and(s.max_price IS NOT NULL) THEN sum(s.max_price) END AS max_price,
       count(*)::int AS service_count,
       json_agg(json_build_object('id', s.id, 'nameEn', s.name_en, 'nameKm', s.name_km,
                                  'minPrice', s.min_price, 'maxPrice', s.max_price) ORDER BY bs.position) AS services_json
  FROM booking_services bs JOIN services s ON s.id = bs.service_id
 GROUP BY bs.booking_id;

-- Invariant: every booking has its primary service in booking_services (position 0).
CREATE FUNCTION booking_primary_service() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO booking_services (booking_id, service_id, position) VALUES (NEW.id, NEW.service_id, 0)
  ON CONFLICT (booking_id, service_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_primary_service AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION booking_primary_service();
