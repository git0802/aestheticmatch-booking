import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMindbodyConfig() {
  try {
    console.log('🔍 Finding practice and EMR credentials...\n');

    // Find the practice
    const practiceId = 'fcbc8cbf-6794-40b6-b0a8-2b0651a459ab';
    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
    });

    if (!practice) {
      console.error(`❌ Practice with ID ${practiceId} not found`);
      return;
    }

    console.log(`✅ Found practice: ${practice.name}`);

    // Find the EMR credential
    const emrCredential = await (prisma as any).emrCredential.findFirst({
      where: {
        ownerId: practiceId,
        ownerType: 'PRACTICE',
        provider: 'MINDBODY',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!emrCredential) {
      console.error('❌ No Mindbody EMR credential found for this practice');
      return;
    }

    console.log('\n📋 Current EMR Credential:');
    console.log(`   ID: ${emrCredential.id}`);
    console.log(`   Provider: ${emrCredential.provider}`);
    console.log(`   Location ID: ${emrCredential.locationId || 'null'}`);
    console.log(`   Mindbody Staff ID: ${emrCredential.mindbodyStaffId || 'null'}`);
    console.log(`   Mindbody Location ID: ${emrCredential.mindbodyLocationId || 'null'}`);
    console.log(`   Mindbody Session Type ID: ${emrCredential.mindbodySessionTypeId || 'null'}`);

    // Update with correct values
    console.log('\n🔧 Updating EMR credential with correct Mindbody configuration...');
    
    // IMPORTANT: Update these values based on your Mindbody account
    const updates = {
      mindbodyStaffId: '100000061', // This is from your logs
      mindbodyLocationId: '1', // ⚠️ REPLACE THIS WITH YOUR ACTUAL LOCATION ID
      mindbodySessionTypeId: '23', // This is from your logs
    };

    console.log('\n📝 New values:');
    console.log(`   Mindbody Staff ID: ${updates.mindbodyStaffId}`);
    console.log(`   Mindbody Location ID: ${updates.mindbodyLocationId}`);
    console.log(`   Mindbody Session Type ID: ${updates.mindbodySessionTypeId}`);

    const updated = await (prisma as any).emrCredential.update({
      where: { id: emrCredential.id },
      data: updates,
    });

    console.log('\n✅ Successfully updated EMR credential!');
    console.log('\n📋 Updated EMR Credential:');
    console.log(`   Mindbody Staff ID: ${updated.mindbodyStaffId}`);
    console.log(`   Mindbody Location ID: ${updated.mindbodyLocationId}`);
    console.log(`   Mindbody Session Type ID: ${updated.mindbodySessionTypeId}`);

    console.log('\n✨ Done! Please restart your backend server for changes to take effect.');
    console.log('   Run: pnpm run start:dev\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMindbodyConfig();
