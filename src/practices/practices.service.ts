import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePracticeDto } from './dto/create-practice.dto';
import { UpdatePracticeDto } from './dto/update-practice.dto';
import { EncryptionService } from '../common/services/encryption.service';
import { MindbodyValidationService } from '../common/services/mindbody-validation.service';
import { Prisma, EmrProvider } from '@prisma/client';
import type { User } from '../auth/interfaces/auth.interface';

@Injectable()
export class PracticesService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private mindbodyValidationService: MindbodyValidationService,
  ) {}

  async create(createPracticeDto: CreatePracticeDto, user: User) {
    // Allow ADMIN and CONCIERGE to create practices
    if (!user.role || !['ADMIN', 'CONCIERGE'].includes(user.role)) {
      throw new ForbiddenException(
        'Only admin and concierge users can create practices',
      );
    }

    const { name, emrCredential, serviceFees } = createPracticeDto;

    // Validate EMR credentials if provided
    let validatedEmrCredential: {
      encryptedData: string;
      fingerprint: string;
    } | null = null;
    if (emrCredential) {
      const validationResult = await this.validateEmrCredential(emrCredential);
      if (!validationResult.isValid) {
        throw new BadRequestException(
          `EMR credential validation failed: ${validationResult.error || 'Unknown error'}`,
        );
      }
      validatedEmrCredential = {
        encryptedData: validationResult.encryptedData!,
        fingerprint: validationResult.fingerprint!,
      };
    }

    try {
      // Use transaction to ensure all data is created atomically
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the practice
        const practice = await prisma.practice.create({
          data: {
            name,
            emrType: emrCredential?.provider || null,
            createdBy: user.id,
          },
        });

        // Create EMR credential if provided and validated
        if (validatedEmrCredential && emrCredential) {
          await (prisma as any).emr_credentials.create({
            data: {
              provider: emrCredential.provider,
              owner_id: practice.id,
              owner_type: 'PRACTICE',
              label:
                emrCredential.label || `${emrCredential.provider} Credentials`,
              encrypted_data: validatedEmrCredential.encryptedData,
              fingerprint: validatedEmrCredential.fingerprint,
              is_valid: true,
              last_validated_at: new Date(),
            },
          });
        }

        // Create service fees if provided
        if (serviceFees && serviceFees.length > 0) {
          await (prisma as any).service_fees.createMany({
            data: serviceFees.map((fee) => ({
              practice_id: practice.id,
              service_name: fee.serviceName,
              price: fee.price,
            })),
          });
        }

        // Return practice with all related data
        return await prisma.practice.findUnique({
          where: { id: practice.id },
          include: {
            createdByUser: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });
      });

      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Practice with this name already exists',
          );
        }
      }
      throw new BadRequestException('Failed to create practice');
    }
  }

  private async validateEmrCredential(
    emrCredential: any,
  ): Promise<{
    isValid: boolean;
    error?: string;
    encryptedData?: string;
    fingerprint?: string;
  }> {
    const { provider, apiKey, siteId, username, password, baseUrl } =
      emrCredential;

    // Prepare credentials object
    const credentials = {
      apiKey,
      siteId,
      ...(username && { username }),
      ...(password && { password }),
      ...(baseUrl && { baseUrl }),
    };

    // Validate credentials based on provider
    let validationResult: { isValid: boolean; error?: string } = {
      isValid: false,
      error: 'Provider not supported',
    };

    if (provider === EmrProvider.MINDBODY) {
      validationResult =
        await this.mindbodyValidationService.validateCredentials(credentials);
    }

    if (!validationResult.isValid) {
      return validationResult;
    }

    // Encrypt the credentials
    const { encryptedData, fingerprint } =
      this.encryptionService.encryptEmrData(credentials);

    return {
      isValid: true,
      encryptedData,
      fingerprint,
    };
  }

  // Method to test EMR credentials without creating practice
  async testEmrCredentials(emrCredential: any) {
    return await this.validateEmrCredential(emrCredential);
  }

  async findAll(user: User) {
    try {
      const where: any = {};

      // Role-based filtering
      if (user.role === 'CONCIERGE') {
        // CONCIERGE users only see practices they created
        where.createdBy = user.id;
      }
      // ADMIN and OPS_FINANCE can see all practices (no additional filter)

      return await this.prisma.practice.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          createdByUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to fetch practices');
    }
  }

  async findOne(id: string, user: User) {
    try {
      const practice = await this.prisma.practice.findUnique({
        where: { id },
        include: {
          createdByUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      if (!practice) {
        throw new NotFoundException('Practice not found');
      }

      // Role-based access control
      if (user.role === 'CONCIERGE' && practice.createdBy !== user.id) {
        throw new ForbiddenException(
          'You can only access practices you created',
        );
      }

      return practice;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch practice');
    }
  }

  async update(id: string, updatePracticeDto: UpdatePracticeDto, user: User) {
    try {
      // Check if practice exists
      const existingPractice = await this.prisma.practice.findUnique({
        where: { id },
      });

      if (!existingPractice) {
        throw new NotFoundException('Practice not found');
      }

      // Role-based update permissions
      if (user.role === 'CONCIERGE') {
        // CONCIERGE can only update practices they created
        if (existingPractice.createdBy !== user.id) {
          throw new ForbiddenException(
            'You can only update practices you created',
          );
        }
      } else if (user.role !== 'ADMIN') {
        // Only ADMIN and CONCIERGE can update practices
        throw new ForbiddenException(
          'Only admin and concierge users can update practices',
        );
      }

      const practice = await this.prisma.practice.update({
        where: { id },
        data: {
          ...(updatePracticeDto.name && { name: updatePracticeDto.name }),
          ...(updatePracticeDto.emrType !== undefined && {
            emrType: updatePracticeDto.emrType,
          }),
          ...(updatePracticeDto.connectorConfig !== undefined && {
            connectorConfig: updatePracticeDto.connectorConfig,
          }),
          ...(updatePracticeDto.feeModel !== undefined && {
            feeModel: updatePracticeDto.feeModel,
          }),
        },
        include: {
          createdByUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return practice;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Practice with this name already exists',
          );
        }
      }
      throw new BadRequestException('Failed to update practice');
    }
  }

  async remove(id: string, user: User) {
    try {
      // Check if practice exists
      const existingPractice = await this.prisma.practice.findUnique({
        where: { id },
      });

      if (!existingPractice) {
        throw new NotFoundException('Practice not found');
      }

      // Role-based delete permissions
      if (user.role === 'CONCIERGE') {
        // CONCIERGE can only delete practices they created
        if (existingPractice.createdBy !== user.id) {
          throw new ForbiddenException(
            'You can only delete practices you created',
          );
        }
      } else if (user.role !== 'ADMIN') {
        // Only ADMIN and CONCIERGE can delete practices
        throw new ForbiddenException(
          'Only admin and concierge users can delete practices',
        );
      }

      await this.prisma.practice.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to delete practice');
    }
  }
}
