import { Injectable, Logger } from '@nestjs/common';
import { NextechService } from './nextech.service';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NextechClientData,
  NextechClientResponse,
  NextechAuthCredentials,
} from './interfaces/client.interface';

interface NextechPracticeContext {
  baseUrl: string;
  username: string;
  password: string;
  practiceId?: string;
  nextechProviderId?: string;
  nextechLocationId?: string;
  nextechAppointmentTypeId?: string;
}

@Injectable()
export class NextechClientService {
  private readonly logger = new Logger(NextechClientService.name);

  constructor(
    private readonly nextechService: NextechService,
    private readonly encryption: EncryptionService,
    private readonly prisma: PrismaService,
  ) {}

  async getPracticeContext(
    practiceId: string,
  ): Promise<NextechPracticeContext> {
    try {
      const credential = await this.prisma.emrCredential.findFirst({
        where: {
          ownerId: practiceId,
          ownerType: 'PRACTICE',
          provider: 'NEXTECH',
        },
      });

      if (!credential) {
        throw new Error(
          `No Nextech EMR credentials found for practice ${practiceId}`,
        );
      }

      let decryptedData: any = {};

      if (credential.encryptedData) {
        try {
          decryptedData = this.encryption.decryptEmrData(
            credential.encryptedData,
          ) as Record<string, unknown>;
          this.logger.log('Successfully decrypted Nextech credentials');
        } catch (error) {
          this.logger.error('Failed to decrypt Nextech credentials:', error);
          throw new Error('Could not decrypt Nextech credentials');
        }
      }

      const baseUrl =
        decryptedData.baseUrl || process.env.NEXTECH_BASE_URL;
      const username = decryptedData.username || process.env.NEXTECH_USERNAME;
      const password = decryptedData.password || process.env.NEXTECH_PASSWORD;
      const practiceIdValue =
        decryptedData.practiceId || process.env.NEXTECH_PRACTICE_ID;

      if (!baseUrl || !username || !password) {
        const missing: string[] = [];
        if (!baseUrl) missing.push('baseUrl');
        if (!username) missing.push('username');
        if (!password) missing.push('password');

        throw new Error(
          `Missing required Nextech credentials for practice ${practiceId}: ${missing.join(', ')}`,
        );
      }

      // Note: Nextech-specific fields will be added to schema in migration
      const nextechProviderId = decryptedData.nextechProviderId;
      const nextechLocationId = decryptedData.nextechLocationId;
      const nextechAppointmentTypeId = decryptedData.nextechAppointmentTypeId;

      this.logger.log(
        `Retrieved Nextech context for practice ${practiceId}: providerId=${nextechProviderId}, locationId=${nextechLocationId}, appointmentTypeId=${nextechAppointmentTypeId}`,
      );

      return {
        baseUrl,
        username,
        password,
        practiceId: practiceIdValue,
        nextechProviderId,
        nextechLocationId,
        nextechAppointmentTypeId,
      };
    } catch (error) {
      this.logger.error('Failed to get practice context:', error);
      throw error;
    }
  }

  async ensureClientExists(
    practiceId: string,
    clientData: NextechClientData,
  ): Promise<NextechClientResponse | null> {
    try {
      const context = await this.getPracticeContext(practiceId);

      const credentials: NextechAuthCredentials = {
        baseUrl: context.baseUrl,
        username: context.username,
        password: context.password,
        practiceId: context.practiceId,
      };

      const result = await this.nextechService.addClient({
        credentials,
        client: clientData,
      });

      if (result) {
        this.logger.log(
          `Client ${result.email} exists/created in Nextech with ID: ${result.nextechId}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to ensure client exists:', error);
      throw error;
    }
  }

  async getCredentials(practiceId: string): Promise<NextechAuthCredentials> {
    const context = await this.getPracticeContext(practiceId);
    return {
      baseUrl: context.baseUrl,
      username: context.username,
      password: context.password,
      practiceId: context.practiceId,
    };
  }
}
