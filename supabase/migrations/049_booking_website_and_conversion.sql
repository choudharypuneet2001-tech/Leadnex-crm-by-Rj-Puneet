-- Migration 049: Add website booking status and patient visit outcome to bookings
-- Allows staff to track whether confirmed bookings have been submitted to the main website,
-- and record post-consultation clinic visit conversion outcomes (Converted, Non Converted, Not Visited).

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS website_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS visit_outcome TEXT NOT NULL DEFAULT 'pending_visit';

CREATE INDEX IF NOT EXISTS idx_bookings_website_status ON bookings(website_status);
CREATE INDEX IF NOT EXISTS idx_bookings_visit_outcome ON bookings(visit_outcome);
