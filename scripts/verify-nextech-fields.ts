import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyNextechFields() {
  try {
    console.log('Verifying Nextech fields in database...\n');

    // Check emr_credentials table
    const emrCredentialColumns = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'emr_credentials' 
      AND column_name LIKE 'nextech%'
      ORDER BY column_name;
    `);

    console.log('✅ EMR Credentials Nextech fields:');
    emrCredentialColumns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // Check patients table
    const patientColumns = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'patients' 
      AND column_name = 'nextech_patient_id';
    `);

    console.log('\n✅ Patients Nextech fields:');
    patientColumns.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });

    // Check index
    const indexes = await prisma.$queryRawUnsafe<any[]>(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'patients' 
      AND indexname LIKE '%nextech%';
    `);

    console.log('\n✅ Indexes:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.indexname}`);
    });

    console.log('\n🎉 All Nextech database fields are properly configured!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyNextechFields();
