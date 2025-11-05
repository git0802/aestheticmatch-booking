import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { MindbodyService } from './mindbody.service';

interface MindbodyPracticeContext {
  credentials: {
    apiKey: string;
    username: string;
    password: string;
    siteId?: string;
  };
  locationId?: string;
  staffId?: string | number;
  sessionTypeId?: string | number;
}

interface EnsureClientResult {
  clientId: string | null;
  patient: {
    name: string;
    email: string;
    phone: string | null;
  };
}

@Injectable()
export class MindBodyClientService {
  private readonly logger = new Logger(MindBodyClientService.name);

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async getPracticeContext(
    practiceId: string,
  ): Promise<MindbodyPracticeContext> {
    const emrCredential = await (this.prisma as any).emrCredential.findFirst({
      where: {
        ownerId: practiceId,
        ownerType: 'PRACTICE',
        provider: 'MINDBODY',
        isValid: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!emrCredential || !emrCredential.encryptedData) {
      throw new Error(
        'Mindbody credentials are not configured for this practice',
      );
    }

    const decrypted = this.encryption.decryptEmrData(
      emrCredential.encryptedData,
    ) as Record<string, unknown>;

    const apiKey = String(decrypted.apiKey || '');
    const username = String(decrypted.username || '');
    const password = String(decrypted.password || '');

    if (!apiKey || !username || !password) {
      throw new Error('Stored Mindbody credentials are incomplete');
    }

    const context: MindbodyPracticeContext = {
      credentials: {
        apiKey,
        username,
        password,
        siteId: decrypted.siteId ? String(decrypted.siteId) : undefined,
      },
      locationId: emrCredential.locationId || undefined,
    };

    // Optional booking helpers if stored alongside credentials
    if (typeof decrypted.staffId !== 'undefined') {
      context.staffId = decrypted.staffId as string | number;
    }
    if (typeof decrypted.sessionTypeId !== 'undefined') {
      context.sessionTypeId = decrypted.sessionTypeId as string | number;
    }

    return context;
  }

  async ensureClientExists(
    patientId: string,
    practiceId: string,
    mindbodyService: MindbodyService,
    contextOverride?: MindbodyPracticeContext,
  ): Promise<EnsureClientResult> {
    // Get patient information
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        dob: true,
        amReferralId: true,
      },
    });

    if (!patient) {
      throw new Error('Patient not found');
    }

    // Check if patient already has a MindBody client ID
    let clientId = patient.amReferralId || null;

    // If patient doesn't have a MindBody client ID, create one
    if (!clientId) {
      try {
        const context =
          contextOverride ?? (await this.getPracticeContext(practiceId));
        const mindbodyClient = await mindbodyService.addClient({
          credentials: context.credentials,
          client: {
            firstName: patient.name.split(' ')[0] || patient.name,
            lastName: patient.name.split(' ').slice(1).join(' ') || '',
            email: patient.email,
            phone: patient.phone || '',
            dateOfBirth: patient.dob ?? undefined,
          },
        });

        clientId = mindbodyClient?.id ?? null;

        // Update patient with the new MindBody client ID
        if (clientId) {
          await this.prisma.patient.update({
            where: { id: patient.id },
            data: { amReferralId: clientId },
          });

          this.logger.log(
            `Created Mindbody client for patient ${patient.id}: ${clientId}`,
          );
        }
      } catch (error) {
        this.logger.error('Failed to create Mindbody client', error);
        return {
          clientId: null,
          patient: {
            name: patient.name,
            email: patient.email,
            phone: patient.phone || null,
          },
        };
      }
    }

    return {
      clientId,
      patient: {
        name: patient.name,
        email: patient.email,
        phone: patient.phone || null,
      },
    };
  }
}
