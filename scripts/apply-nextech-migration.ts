import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyNextechMigration() {
  try {
    console.log('Applying Nextech fields migration...');

    // Add Nextech fields to emr_credentials table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE emr_credentials 
      ADD COLUMN IF NOT EXISTS nextech_provider_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS nextech_location_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS nextech_appointment_type_id VARCHAR(50);
    `);

    console.log('✓ Added Nextech fields to emr_credentials table');

    // Add Nextech patient ID field to patients table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE patients
      ADD COLUMN IF NOT EXISTS nextech_patient_id VARCHAR(100);
    `);

    console.log('✓ Added nextech_patient_id field to patients table');

    // Add index for faster lookups
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_patients_nextech_patient_id 
      ON patients(nextech_patient_id);
    `);

    console.log('✓ Created index on nextech_patient_id');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyNextechMigration();
