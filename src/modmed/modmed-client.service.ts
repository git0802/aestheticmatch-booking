import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModmedService } from './modmed.service';
import { EncryptionService } from '../common/services/encryption.service';
import { ModmedAuthCredentials } from './interfaces/client.interface';

@Injectable()
export class ModmedClientService {
  private readonly logger = new Logger(ModmedClientService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly modmedService: ModmedService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Get ModMed credentials for a practice
   */
  private async getCredentials(practiceId: string): Promise<ModmedAuthCredentials | null> {
    try {
      const credential = await this.prisma.emrCredential.findFirst({
        where: {
          ownerId: practiceId,
          ownerType: 'PRACTICE',
          provider: 'MODMED',
        },
      });

      if (!credential) {
        this.logger.warn(`No ModMed credentials found for practice ${practiceId}`);
        return null;
      }

      let decryptedData: any = {};

      if (credential.encryptedData) {
        try {
          decryptedData = this.encryption.decryptEmrData(
            credential.encryptedData,
          ) as Record<string, unknown>;
          this.logger.log('Successfully decrypted ModMed credentials');
        } catch (error) {
          this.logger.error('Failed to decrypt ModMed credentials:', error);
          throw new Error('Could not decrypt ModMed credentials');
        }
      }

      const baseUrl = decryptedData.baseUrl || process.env.MODMED_BASE_URL;
      const clientId = decryptedData.clientId || process.env.MODMED_CLIENT_ID;
      const clientSecret = decryptedData.clientSecret || process.env.MODMED_CLIENT_SECRET;
      const practiceIdValue = decryptedData.practiceId || process.env.MODMED_PRACTICE_ID;

      if (!baseUrl || !clientId || !clientSecret) {
        const missing: string[] = [];
        if (!baseUrl) missing.push('baseUrl');
        if (!clientId) missing.push('clientId');
        if (!clientSecret) missing.push('clientSecret');

        throw new Error(
          `Missing required ModMed credentials for practice ${practiceId}: ${missing.join(', ')}`,
        );
      }

      return {
        baseUrl,
        clientId,
        clientSecret,
        practiceId: practiceIdValue,
      };
    } catch (error) {
      this.logger.error('Error getting ModMed credentials', error.message);
      throw error;
    }
  }

  /**
   * Get or create a patient for a practice
   */
  async getOrCreatePatient(params: {
    practiceId: string;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      dateOfBirth?: Date;
    };
  }) {
    try {
      const { practiceId, patient } = params;

      this.logger.log(`Getting or creating ModMed patient for practice ${practiceId}`);

      // Get ModMed credentials
      const credentials = await this.getCredentials(practiceId);
      if (!credentials) {
        throw new Error(`ModMed credentials not found for practice ${practiceId}`);
      }

      // Check if patient already has a ModMed ID
      const existingPatient = await this.prisma.patient.findUnique({
        where: { id: patient.id },
      });

      if ((existingPatient as any)?.modmedPatientId) {
        this.logger.log(`Patient already has ModMed ID: ${(existingPatient as any).modmedPatientId}`);
        return {
          success: true,
          modmedPatientId: (existingPatient as any).modmedPatientId,
        };
      }

      // Add or find client in ModMed
      const modmedClient = await this.modmedService.addClient(credentials, {
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
      });

      // Update patient with ModMed ID
      await this.prisma.patient.update({
        where: { id: patient.id },
        data: {
          modmedPatientId: modmedClient.modmedId,
        } as any,
      });

      this.logger.log(`Patient linked to ModMed ID: ${modmedClient.modmedId}`);

      return {
        success: true,
        modmedPatientId: modmedClient.modmedId,
      };
    } catch (error) {
      this.logger.error('Error getting or creating ModMed patient', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Book an appointment for a practice
   */
  async bookForPractice(params: {
    practiceId: string;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      dateOfBirth?: Date;
    };
    appointment: {
      startDateTime: Date;
      duration?: number;
      notes?: string;
    };
  }) {
    try {
      const { practiceId, patient, appointment } = params;

      this.logger.log(`Booking ModMed appointment for practice ${practiceId}`);

      // Get ModMed credentials
      const credentials = await this.getCredentials(practiceId);
      if (!credentials) {
        throw new Error(`ModMed credentials not found for practice ${practiceId}`);
      }

      // Get or create patient
      const patientResult = await this.getOrCreatePatient({ practiceId, patient });
      if (!patientResult.success || !patientResult.modmedPatientId) {
        throw new Error('Failed to get or create ModMed patient');
      }

      // Get credential details for booking parameters
      const emrCredential = await this.prisma.emrCredential.findFirst({
        where: {
          ownerId: practiceId,
          ownerType: 'PRACTICE',
          provider: 'MODMED',
        },
      });

      if (!emrCredential) {
        throw new Error('ModMed credentials not found');
      }

      // Decrypt credential data to get configuration
      let decryptedData: any = {};
      if (emrCredential.encryptedData) {
        decryptedData = this.encryption.decryptEmrData(
          emrCredential.encryptedData,
        ) as Record<string, unknown>;
      }

      // Resolve booking parameters
      const bookingParams = await this.modmedService.resolveBookingParams(credentials, {
        providerId: decryptedData.modmedProviderId || undefined,
        locationId: decryptedData.modmedLocationId || undefined,
        appointmentTypeId: decryptedData.modmedAppointmentTypeId || undefined,
      });

      // Book appointment
      const bookingResult = await this.modmedService.bookAppointment(credentials, {
        patientId: patientResult.modmedPatientId,
        providerId: bookingParams.providerId,
        locationId: bookingParams.locationId,
        appointmentTypeId: bookingParams.appointmentTypeId,
        startDateTime: appointment.startDateTime.toISOString(),
        duration: appointment.duration || 30,
        notes: appointment.notes,
      });

      if (!bookingResult.success) {
        throw new Error(bookingResult.error || 'Failed to book appointment');
      }

      this.logger.log(`ModMed appointment booked: ${bookingResult.appointmentId}`);

      return {
        success: true,
        appointmentId: bookingResult.appointmentId,
        externalAppointmentId: bookingResult.externalAppointmentId,
      };
    } catch (error) {
      this.logger.error('Error booking ModMed appointment', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
