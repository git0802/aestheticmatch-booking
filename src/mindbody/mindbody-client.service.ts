import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MindBodyClientData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
}

@Injectable()
export class MindBodyClientService {
  constructor(private prisma: PrismaService) {}

  async getPracticeStaffId(
    practiceId: string,
  ): Promise<{ staffId?: string | number } | null> {
    try {
      const practice = await this.prisma.practice.findUnique({
        where: { id: practiceId },
      });

      if (!practice || !practice.connectorConfig) {
        return null;
      }

      const config =
        typeof practice.connectorConfig === 'string'
          ? JSON.parse(practice.connectorConfig)
          : practice.connectorConfig;

      const mindbodyConfig = config?.mindbody ?? config;
      const staffId =
        mindbodyConfig?.staffId ?? mindbodyConfig?.default?.staffId;

      return { staffId };
    } catch (error) {
      console.error('Failed to get practice staffId:', error);
      return null;
    }
  }

  async ensureClientExists(
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
        const mindbodyClient = await mindbodyService.addClient({
          firstName: patient.name.split(' ')[0] || patient.name,
          lastName: patient.name.split(' ').slice(1).join(' ') || '',
          email: patient.email,
          phone: patient.phone || '',
          dateOfBirth: patient.dob,
        });

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
