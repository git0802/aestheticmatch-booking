import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MindBodyClientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
}

export interface MindBodyClientResponse {
  id: string;
  mindbodyId: string;
}

@Injectable()
export class MindBodyClientHelper {
  constructor(private prisma: PrismaService) {}

  async ensurePatientHasClientId(
    patientId: string,
    mindbodyService: any,
  ): Promise<string | null> {
    // Get patient information
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new Error('Patient not found');
    }

    // Check if patient already has a MindBody client ID
    let clientId = patient.amReferralId;

    // If patient doesn't have a MindBody client ID, create one
    if (!clientId) {
      try {
        // Mock implementation for now - replace with actual MindBody API call
        const mindbodyClient: MindBodyClientResponse = {
          id: `mb_${Date.now()}`,
          mindbodyId: `mb_${Date.now()}`,
        };

        clientId = mindbodyClient.id;

        // Update patient with the new MindBody client ID
        await this.prisma.patient.update({
          where: { id: patient.id },
          data: { amReferralId: clientId },
        });

        console.log(
          `Created MindBody client for patient ${patient.id}: ${clientId}`,
        );
      } catch (error) {
        console.error('Failed to create MindBody client:', error);
        // Return null to indicate client creation failed but allow appointment creation to continue
        return null;
      }
    }

    return clientId;
  }
}
