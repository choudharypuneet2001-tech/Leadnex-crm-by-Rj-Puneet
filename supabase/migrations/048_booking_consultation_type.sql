-- Migration 048: Add consultation_type and clinic_location to bookings
-- Differentiates between Clinic Visit appointments and Online Video Consultations.

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS consultation_type TEXT NOT NULL DEFAULT 'video_consultation',
ADD COLUMN IF NOT EXISTS clinic_location TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_consultation_type ON bookings(consultation_type);

