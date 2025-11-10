-- Add Nextech-specific configuration fields to emr_credentials table
ALTER TABLE emr_credentials 
ADD COLUMN IF NOT EXISTS nextech_provider_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS nextech_location_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS nextech_appointment_type_id VARCHAR(50);

-- Add Nextech patient ID field to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS nextech_patient_id VARCHAR(100);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_nextech_patient_id ON patients(nextech_patient_id);
