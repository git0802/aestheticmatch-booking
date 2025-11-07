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
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  created?: boolean; // indicates if we created the client this call
  error?: string; // propagate creation error reason
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
        firstName: true,
        lastName: true,
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
      const context =
        contextOverride ?? (await this.getPracticeContext(practiceId));
      try {
        // Trim names to avoid whitespace issues
        const firstName = (patient.firstName || 'Client').trim();
        const lastName = (patient.lastName || 'Unknown').trim();

        // Primary attempt using patient data
        this.logger.log(
          `Attempting to create Mindbody client for patient ${patient.id} with firstName: ${firstName}, lastName: ${lastName}`,
        );
        const mindbodyClient = await mindbodyService.addClient({
          credentials: context.credentials,
          client: {
            firstName,
            lastName,
            email: patient.email,
            phone: patient.phone || '',
            dateOfBirth: patient.dob ?? undefined,
          },
        });
        this.logger.log(
          `addClient returned: ${JSON.stringify(mindbodyClient)}`,
        );
        clientId = mindbodyClient?.id ?? null;

        if (!clientId) {
          // Fallback attempt with minimal payload (no email/phone in case formatting caused failure)
          const fallbackClient = await mindbodyService.addClient({
            credentials: context.credentials,
            client: {
              firstName,
              lastName,
              email: '',
              phone: '',
            },
          });
          clientId = fallbackClient?.id ?? null;
        }

        if (clientId) {
          await this.prisma.patient.update({
            where: { id: patient.id },
            data: { amReferralId: clientId },
          });
          this.logger.log(
            `Created Mindbody client for patient ${patient.id}: ${clientId}`,
          );
          return {
            clientId,
            patient: {
              firstName,
              lastName,
              email: patient.email,
              phone: patient.phone || null,
            },
            created: true,
          };
        } else {
          return {
            clientId: null,
            patient: {
              firstName,
              lastName,
              email: patient.email,
              phone: patient.phone || null,
            },
            error:
              'Mindbody did not return a client ID after creation attempts',
          };
        }
      } catch (error) {
        this.logger.error(
          `Failed to create Mindbody client for patient ${patient.id}:`,
          error,
        );
        this.logger.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });
        return {
          clientId: null,
          patient: {
            firstName: (patient.firstName || 'Client').trim(),
            lastName: (patient.lastName || 'Unknown').trim(),
            email: patient.email,
            phone: patient.phone || null,
          },
          error:
            error instanceof Error
              ? error.message
              : 'Unknown error creating client',
        };
      }
    }

    return {
      clientId,
      patient: {
        firstName: (patient.firstName || 'Client').trim(),
        lastName: (patient.lastName || 'Unknown').trim(),
        email: patient.email,
        phone: patient.phone || null,
      },
      created: false,
    };
  }
}
