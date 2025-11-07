import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePracticeDto } from './dto/create-practice.dto';
import { UpdatePracticeDto } from './dto/update-practice.dto';
import { EncryptionService } from '../common/services/encryption.service';
import { MindbodyValidationService } from '../common/services/mindbody-validation.service';
import { MindbodyService } from '../mindbody/mindbody.service';
import { Prisma, EmrProvider } from '@prisma/client';
import type { User } from '../auth/interfaces/auth.interface';

@Injectable()
export class PracticesService {
  private readonly logger = new Logger(PracticesService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private mindbodyValidationService: MindbodyValidationService,
    private mindbodyService: MindbodyService,
  ) {}

  async create(createPracticeDto: CreatePracticeDto, user: User) {
    // Allow ADMIN and CONCIERGE to create practices
    if (!user.role || !['ADMIN', 'CONCIERGE'].includes(user.role)) {
      throw new ForbiddenException(
        'Only admin and concierge users can create practices',
      );
    }

    const {
      name,
      emrCredential,
      serviceFees,
      availabilities,
      mindbodyStaffId,
      mindbodyLocationId,
      mindbodySessionTypeId,
    } = createPracticeDto;

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
      console.log('Starting transaction...');
      // Keep interactive transaction as short as possible (create rows only)
      const createdPractice = await this.prisma.$transaction(
        async (tx) => {
          console.log('Creating practice...');
          const practice = await tx.practice.create({
            data: {
              name,
              emrType: emrCredential?.provider || null,
              createdBy: user.id,
            },
          });
          console.log('Practice created:', practice.id);

          if (validatedEmrCredential && emrCredential) {
            console.log('Creating EMR credential...');
            await tx.emrCredential.create({
              data: {
                provider: emrCredential.provider,
                ownerId: practice.id,
                ownerType: 'PRACTICE',
                label:
                  emrCredential.label ||
                  `${emrCredential.provider} Credentials`,
                locationId: emrCredential.locationId || null,
                encryptedData: validatedEmrCredential.encryptedData,
                fingerprint: validatedEmrCredential.fingerprint,
                isValid: true,
                lastValidatedAt: new Date(),
                // Add Mindbody configuration fields
                ...(mindbodyStaffId && { mindbodyStaffId }),
                ...(mindbodyLocationId && { mindbodyLocationId }),
                ...(mindbodySessionTypeId && { mindbodySessionTypeId }),
              } as any,
            });
            console.log('EMR credential created');
          }

          if (serviceFees && serviceFees.length > 0) {
            await tx.serviceFee.createMany({
              data: serviceFees.map((fee) => ({
                practiceId: practice.id,
                serviceName: fee.serviceName,
                serviceType: fee.serviceType as any,
                price: fee.price,
              })),
            });
            console.log('Service fees created');
          }

          if (availabilities && availabilities.length > 0) {
            await (tx as any).practiceAvailability.createMany({
              data: availabilities.map((avail) => ({
                practiceId: practice.id,
                startDateTime: new Date(avail.startDateTime),
                endDateTime: new Date(avail.endDateTime),
              })),
            });
            console.log('Practice availabilities created');
          }

          return practice;
        },
        {
          // Increase wait and transaction timeouts to avoid P2028 under pool pressure
          maxWait: 15000, // ms to wait for a connection from the pool
          timeout: 20000, // ms before aborting the interactive transaction
        },
      );

      // Sync availabilities to Mindbody AFTER database transaction completes
      if (
        emrCredential?.provider === EmrProvider.MINDBODY &&
        validatedEmrCredential &&
        availabilities &&
        availabilities.length > 0 &&
        mindbodyStaffId &&
        mindbodyLocationId
      ) {
        try {
          const credentials = this.encryptionService.decryptEmrData(
            validatedEmrCredential.encryptedData,
          );

          const mindbodyAvailabilities = availabilities.map((avail) => ({
            staffId: Number(mindbodyStaffId),
            locationId: Number(mindbodyLocationId),
            startDateTime: new Date(avail.startDateTime).toISOString(),
            endDateTime: new Date(avail.endDateTime).toISOString(),
            displayName: 'Available for Booking',
            sessionTypeIds: mindbodySessionTypeId
              ? [Number(mindbodySessionTypeId)]
              : [],
          }));

          const result = await this.mindbodyService.addAvailabilities(
            credentials,
            mindbodyAvailabilities,
          );

          if (result.success) {
            this.logger.log(
              `Successfully synced ${availabilities.length} availability schedules to Mindbody for practice ${createdPractice.id}`,
            );
          } else {
            this.logger.warn(
              `Failed to sync availabilities to Mindbody: ${result.error}. ` +
                `Availabilities saved locally but not in Mindbody.`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Error syncing availabilities to Mindbody for practice ${createdPractice.id}:`,
            error,
          );
        }
      }

      // Fetch with related data OUTSIDE the transaction for minimal lock time
      const result = await this.prisma.practice.findUnique({
        where: { id: createdPractice.id },
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

      return result;
    } catch (error) {
      console.error('Error creating practice:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Practice with this name already exists',
          );
        }
        if (error.code === 'P2028') {
          throw new BadRequestException(
            'Database is busy. Please retry creating the practice in a moment.',
          );
        }
        throw new BadRequestException(
          `Database error: ${error.code} - ${error.message}`,
        );
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to create practice: ${error.message || 'Unknown error'}`,
      );
    }
  }

  private buildCredentialPayload(
    emrCredential: Record<string, any>,
  ): Record<string, any> {
    const payload: Record<string, any> = {
      apiKey: emrCredential.apiKey,
      siteId: emrCredential.siteId,
    };

    if (emrCredential.username) {
      payload.username = emrCredential.username;
    }
    if (emrCredential.password) {
      payload.password = emrCredential.password;
    }
    if (emrCredential.baseUrl) {
      payload.baseUrl = emrCredential.baseUrl;
    }

    return payload;
  }

  private async validateEmrCredential(emrCredential: any): Promise<{
    isValid: boolean;
    error?: string;
    encryptedData?: string;
    fingerprint?: string;
  }> {
    const { provider, apiKey, siteId, username, password, baseUrl } =
      emrCredential;

    // Prepare credentials object
    const credentials = this.buildCredentialPayload({
      apiKey,
      siteId,
      username,
      password,
      baseUrl,
    });

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

      const practices = await this.prisma.practice.findMany({
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
          serviceFees: true,
        },
      });

      // Attach non-secret EMR credential metadata (if any) for each practice
      const results = await Promise.all(
        practices.map(async (p) => {
          try {
            const cred = await (this.prisma as any).emrCredential.findFirst({
              where: { ownerId: p.id, ownerType: 'PRACTICE' },
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                provider: true,
                label: true,
                locationId: true,
                isValid: true,
                lastValidatedAt: true,
                validationError: true,
              },
            });
            return { ...p, emrCredentialMeta: cred || null } as any;
          } catch {
            return { ...p, emrCredentialMeta: null } as any;
          }
        }),
      );
      return results;
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
          serviceFees: true,
          availabilities: true,
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

      // Attach non-secret EMR credential metadata (if any)
      try {
        const cred = await (this.prisma as any).emrCredential.findFirst({
          where: { ownerId: practice.id, ownerType: 'PRACTICE' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            provider: true,
            label: true,
            locationId: true,
            isValid: true,
            lastValidatedAt: true,
            validationError: true,
            encryptedData: true,
            mindbodyStaffId: true,
            mindbodyLocationId: true,
            mindbodySessionTypeId: true,
          },
        });
        let emrCredentialDecrypted: any = null;
        if (cred?.encryptedData) {
          try {
            const data = this.encryptionService.decryptEmrData(
              cred.encryptedData,
            );
            emrCredentialDecrypted = {
              provider: cred.provider,
              label: cred.label ?? null,
              ...data,
            };
          } catch (e) {
            // Swallow decryption errors, still return meta
            emrCredentialDecrypted = null;
          }
        }
        const { encryptedData, ...meta } = cred || ({} as any);
        return {
          ...(practice as any),
          // Map Mindbody config from EMR credential to practice for frontend compatibility
          mindbodyStaffId: cred?.mindbodyStaffId || null,
          mindbodyLocationId: cred?.mindbodyLocationId || null,
          mindbodySessionTypeId: cred?.mindbodySessionTypeId || null,
          emrCredentialMeta: cred ? meta : null,
          emrCredentialDecrypted,
        };
      } catch {
        return {
          ...(practice as any),
          mindbodyStaffId: null,
          mindbodyLocationId: null,
          mindbodySessionTypeId: null,
          emrCredentialMeta: null,
          emrCredentialDecrypted: null,
        };
      }
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

      const existingCredentialRecord = updatePracticeDto.emrCredential
        ? await (this.prisma as any).emrCredential.findFirst({
            where: { ownerId: id, ownerType: 'PRACTICE' },
            orderBy: { createdAt: 'desc' },
          })
        : null;

      let validatedEmrCredential: {
        provider: EmrProvider;
        encryptedData: string;
        fingerprint: string;
        label?: string;
        locationId: string | null;
      } | null = null;

      if (updatePracticeDto.emrCredential) {
        const resolvedLabel =
          updatePracticeDto.emrCredential.label !== undefined
            ? updatePracticeDto.emrCredential.label
            : (existingCredentialRecord?.label ?? undefined);

        const rawLocation = updatePracticeDto.emrCredential.locationId;
        let resolvedLocationId: string | null = null;
        if (typeof rawLocation === 'string') {
          const trimmed = rawLocation.trim();
          resolvedLocationId = trimmed.length > 0 ? trimmed : null;
        } else if (rawLocation) {
          resolvedLocationId = rawLocation;
        } else {
          resolvedLocationId = existingCredentialRecord?.locationId ?? null;
        }

        let reusedExisting = false;
        if (existingCredentialRecord?.encryptedData) {
          try {
            const candidatePayload = this.buildCredentialPayload(
              updatePracticeDto.emrCredential,
            );
            const candidateFingerprint =
              this.encryptionService.createFingerprint(
                JSON.stringify(candidatePayload),
              );

            if (
              candidateFingerprint === existingCredentialRecord.fingerprint &&
              existingCredentialRecord.provider ===
                updatePracticeDto.emrCredential.provider
            ) {
              validatedEmrCredential = {
                provider: existingCredentialRecord.provider as EmrProvider,
                encryptedData: existingCredentialRecord.encryptedData,
                fingerprint: existingCredentialRecord.fingerprint,
                label: resolvedLabel,
                locationId: resolvedLocationId,
              };
              reusedExisting = true;
            }
          } catch (comparisonError) {
            // Ignore fingerprint comparison errors; fall back to full validation
            reusedExisting = false;
          }
        }

        if (!reusedExisting) {
          const validationResult = await this.validateEmrCredential(
            updatePracticeDto.emrCredential,
          );
          if (!validationResult.isValid) {
            throw new BadRequestException(
              `EMR credential validation failed: ${
                validationResult.error || 'Unknown error'
              }`,
            );
          }
          if (
            !validationResult.encryptedData ||
            !validationResult.fingerprint
          ) {
            throw new BadRequestException(
              'EMR credential validation did not return encrypted data',
            );
          }

          validatedEmrCredential = {
            provider: updatePracticeDto.emrCredential.provider,
            encryptedData: validationResult.encryptedData,
            fingerprint: validationResult.fingerprint,
            label: resolvedLabel,
            locationId: resolvedLocationId,
          };
        }
      }

      const result = await this.prisma.$transaction(
        async (tx) => {
          const practice = await tx.practice.update({
            where: { id },
            data: {
              ...(updatePracticeDto.name && { name: updatePracticeDto.name }),
              ...(updatePracticeDto.emrType !== undefined
                ? { emrType: updatePracticeDto.emrType }
                : validatedEmrCredential
                  ? { emrType: validatedEmrCredential.provider }
                  : {}),
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

        if (validatedEmrCredential) {
          const existingCredential = await (tx as any).emrCredential.findFirst({
            where: { ownerId: id, ownerType: 'PRACTICE' },
            orderBy: { createdAt: 'desc' },
          });

          if (
            existingCredential?.fingerprint !==
            validatedEmrCredential.fingerprint
          ) {
            const duplicate = await (tx as any).emrCredential.findUnique({
              where: { fingerprint: validatedEmrCredential.fingerprint },
            });
            if (duplicate && duplicate.id !== existingCredential?.id) {
              throw new BadRequestException(
                'These EMR credentials already exist.',
              );
            }
          }

          const baseData = {
            provider: validatedEmrCredential.provider,
            label:
              validatedEmrCredential.label ??
              existingCredential?.label ??
              `${validatedEmrCredential.provider} Credentials`,
            locationId: validatedEmrCredential.locationId,
            encryptedData: validatedEmrCredential.encryptedData,
            fingerprint: validatedEmrCredential.fingerprint,
            isValid: true,
            lastValidatedAt: new Date(),
            validationError: null,
            // Add Mindbody configuration fields
            ...(updatePracticeDto.mindbodyStaffId !== undefined && {
              mindbodyStaffId: updatePracticeDto.mindbodyStaffId,
            }),
            ...(updatePracticeDto.mindbodyLocationId !== undefined && {
              mindbodyLocationId: updatePracticeDto.mindbodyLocationId,
            }),
            ...(updatePracticeDto.mindbodySessionTypeId !== undefined && {
              mindbodySessionTypeId: updatePracticeDto.mindbodySessionTypeId,
            }),
          } as any;

          if (existingCredential) {
            await (tx as any).emrCredential.update({
              where: { id: existingCredential.id },
              data: baseData,
            });
          } else {
            await (tx as any).emrCredential.create({
              data: {
                ownerId: id,
                ownerType: 'PRACTICE',
                ...baseData,
              },
            });
          }
        }

        // Update Mindbody configuration even if credentials weren't changed
        if (
          !validatedEmrCredential &&
          (updatePracticeDto.mindbodyStaffId !== undefined ||
            updatePracticeDto.mindbodyLocationId !== undefined ||
            updatePracticeDto.mindbodySessionTypeId !== undefined)
        ) {
          const existingCredential = await (tx as any).emrCredential.findFirst({
            where: { ownerId: id, ownerType: 'PRACTICE' },
            orderBy: { createdAt: 'desc' },
          });

          if (existingCredential) {
            await (tx as any).emrCredential.update({
              where: { id: existingCredential.id },
              data: {
                ...(updatePracticeDto.mindbodyStaffId !== undefined && {
                  mindbodyStaffId: updatePracticeDto.mindbodyStaffId,
                }),
                ...(updatePracticeDto.mindbodyLocationId !== undefined && {
                  mindbodyLocationId: updatePracticeDto.mindbodyLocationId,
                }),
                ...(updatePracticeDto.mindbodySessionTypeId !== undefined && {
                  mindbodySessionTypeId:
                    updatePracticeDto.mindbodySessionTypeId,
                }),
              } as any,
            });
          }
        }

        if (updatePracticeDto.serviceFees) {
          // Detach linked appointments before replacing the service fee catalog to avoid FK violations
          await tx.appointment.updateMany({
            where: { practiceId: id, serviceFeeId: { not: null } },
            data: { serviceFeeId: null },
          });

          await tx.serviceFee.deleteMany({ where: { practiceId: id } });
          if (updatePracticeDto.serviceFees.length > 0) {
            await tx.serviceFee.createMany({
              data: updatePracticeDto.serviceFees.map((fee) => ({
                practiceId: id,
                serviceName: fee.serviceName,
                serviceType: fee.serviceType as any,
                price: fee.price,
              })),
            });
          }
        }

        // Update practice availabilities
        if (updatePracticeDto.availabilities !== undefined) {
          // Delete all existing availabilities
          await (tx as any).practiceAvailability.deleteMany({
            where: { practiceId: id },
          });

          // Create new availabilities
          if (updatePracticeDto.availabilities.length > 0) {
            await (tx as any).practiceAvailability.createMany({
              data: updatePracticeDto.availabilities.map((avail) => ({
                practiceId: id,
                startDateTime: new Date(avail.startDateTime),
                endDateTime: new Date(avail.endDateTime),
              })),
            });
          }
        }

        return practice;
      },
      {
        maxWait: 10000, // 10 seconds max wait time
        timeout: 15000, // 15 seconds timeout
      },
      );

      // Sync availabilities to Mindbody AFTER database transaction completes
      if (
        result.emrType === EmrProvider.MINDBODY &&
        updatePracticeDto.availabilities !== undefined
      ) {
        try {
          // Get the EMR credential
          const emrCred = await (this.prisma as any).emrCredential.findFirst({
            where: { ownerId: id, ownerType: 'PRACTICE' },
            orderBy: { createdAt: 'desc' },
          });

          if (emrCred?.encryptedData) {
            const credentials = this.encryptionService.decryptEmrData(
              emrCred.encryptedData,
            );

            const staffId =
              updatePracticeDto.mindbodyStaffId ??
              emrCred.mindbodyStaffId;
            const locationId =
              updatePracticeDto.mindbodyLocationId ??
              emrCred.mindbodyLocationId;
            const sessionTypeId =
              updatePracticeDto.mindbodySessionTypeId ??
              emrCred.mindbodySessionTypeId;

            if (
              staffId &&
              locationId &&
              updatePracticeDto.availabilities.length > 0
            ) {
              const mindbodyAvailabilities =
                updatePracticeDto.availabilities.map((avail) => ({
                  staffId: Number(staffId),
                  locationId: Number(locationId),
                  startDateTime: new Date(avail.startDateTime).toISOString(),
                  endDateTime: new Date(avail.endDateTime).toISOString(),
                  displayName: 'Available for Booking',
                  sessionTypeIds: sessionTypeId
                    ? [Number(sessionTypeId)]
                    : [],
                }));

              const syncResult = await this.mindbodyService.addAvailabilities(
                credentials,
                mindbodyAvailabilities,
              );

              if (syncResult.success) {
                this.logger.log(
                  `Successfully synced ${updatePracticeDto.availabilities.length} availability schedules to Mindbody for practice ${id}`,
                );
              } else {
                this.logger.warn(
                  `Failed to sync availabilities to Mindbody: ${syncResult.error}. ` +
                    `Availabilities saved locally but not in Mindbody.`,
                );
              }
            } else {
              this.logger.warn(
                `Cannot sync availabilities to Mindbody: Missing staffId or locationId for practice ${id}`,
              );
            }
          }
        } catch (error) {
          this.logger.error(
            `Error syncing availabilities to Mindbody for practice ${id}:`,
            error,
          );
        }
      }

      return result;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Practice with this name already exists',
          );
        }
      }
      throw new BadRequestException(
        `Failed to update practice: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
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

  // Practice Availability Management

  async addAvailability(
    practiceId: string,
    availabilityData: {
      startDateTime: string;
      endDateTime: string;
    },
    user: User,
  ) {
    // Verify practice exists and user has access
    const practice = await this.prisma.practice.findUnique({
      where: { id: practiceId },
    });

    if (!practice) {
      throw new NotFoundException('Practice not found');
    }

    // Role-based permissions
    if (user.role === 'CONCIERGE' && practice.createdBy !== user.id) {
      throw new ForbiddenException('You can only modify practices you created');
    } else if (user.role && !['ADMIN', 'CONCIERGE'].includes(user.role)) {
      throw new ForbiddenException(
        'Only admin and concierge users can modify practices',
      );
    }

    // Validate datetime logic
    const startDateTime = new Date(availabilityData.startDateTime);
    const endDateTime = new Date(availabilityData.endDateTime);

    if (isNaN(startDateTime.getTime())) {
      throw new BadRequestException('Invalid startDateTime format');
    }
    if (isNaN(endDateTime.getTime())) {
      throw new BadRequestException('Invalid endDateTime format');
    }
    if (startDateTime >= endDateTime) {
      throw new BadRequestException('startDateTime must be before endDateTime');
    }

    return (this.prisma as any).practiceAvailability.create({
      data: {
        practiceId,
        startDateTime: startDateTime,
        endDateTime: endDateTime,
      },
    });
  }

  async getAvailabilities(practiceId: string) {
    const practice = await this.prisma.practice.findUnique({
      where: { id: practiceId },
    });

    if (!practice) {
      throw new NotFoundException('Practice not found');
    }

    return (this.prisma as any).practiceAvailability.findMany({
      where: { practiceId },
      orderBy: { startDateTime: 'asc' },
    });
  }

  async updateAvailability(
    practiceId: string,
    availabilityId: string,
    updateData: {
      startDateTime?: string;
      endDateTime?: string;
    },
    user: User,
  ) {
    const practice = await this.prisma.practice.findUnique({
      where: { id: practiceId },
    });

    if (!practice) {
      throw new NotFoundException('Practice not found');
    }

    // Role-based permissions
    if (user.role === 'CONCIERGE' && practice.createdBy !== user.id) {
      throw new ForbiddenException('You can only modify practices you created');
    } else if (user.role && !['ADMIN', 'CONCIERGE'].includes(user.role)) {
      throw new ForbiddenException(
        'Only admin and concierge users can modify practices',
      );
    }

    const availability = await (
      this.prisma as any
    ).practiceAvailability.findUnique({
      where: { id: availabilityId },
    });

    if (!availability || availability.practiceId !== practiceId) {
      throw new NotFoundException('Availability not found');
    }

    // Validate datetime logic if provided
    const updateObject: any = {};

    if (updateData.startDateTime) {
      const startDateTime = new Date(updateData.startDateTime);
      if (isNaN(startDateTime.getTime())) {
        throw new BadRequestException('Invalid startDateTime format');
      }
      updateObject.startDateTime = startDateTime;
    }

    if (updateData.endDateTime) {
      const endDateTime = new Date(updateData.endDateTime);
      if (isNaN(endDateTime.getTime())) {
        throw new BadRequestException('Invalid endDateTime format');
      }
      updateObject.endDateTime = endDateTime;
    }

    // Validate that start is before end
    const finalStartDateTime =
      updateObject.startDateTime || availability.startDateTime;
    const finalEndDateTime =
      updateObject.endDateTime || availability.endDateTime;
    if (new Date(finalStartDateTime) >= new Date(finalEndDateTime)) {
      throw new BadRequestException('startDateTime must be before endDateTime');
    }

    return (this.prisma as any).practiceAvailability.update({
      where: { id: availabilityId },
      data: updateObject,
    });
  }

  async deleteAvailability(
    practiceId: string,
    availabilityId: string,
    user: User,
  ) {
    const practice = await this.prisma.practice.findUnique({
      where: { id: practiceId },
    });

    if (!practice) {
      throw new NotFoundException('Practice not found');
    }

    // Role-based permissions
    if (user.role === 'CONCIERGE' && practice.createdBy !== user.id) {
      throw new ForbiddenException('You can only modify practices you created');
    } else if (user.role && !['ADMIN', 'CONCIERGE'].includes(user.role)) {
      throw new ForbiddenException(
        'Only admin and concierge users can modify practices',
      );
    }

    const availability = await (
      this.prisma as any
    ).practiceAvailability.findUnique({
      where: { id: availabilityId },
    });

    if (!availability || availability.practiceId !== practiceId) {
      throw new NotFoundException('Availability not found');
    }

    await (this.prisma as any).practiceAvailability.delete({
      where: { id: availabilityId },
    });

    return { success: true };
  }

  async isTimeAvailable(
    practiceId: string,
    appointmentDate: Date,
  ): Promise<boolean> {
    const availabilities = await (
      this.prisma as any
    ).practiceAvailability.findMany({
      where: { practiceId },
    });

    // If no availabilities are set, allow all times (backward compatibility)
    if (availabilities.length === 0) {
      return true;
    }

    // Check if appointment time falls within any availability window
    return availabilities.some((availability: any) => {
      const startDateTime = new Date(availability.startDateTime);
      const endDateTime = new Date(availability.endDateTime);

      return appointmentDate >= startDateTime && appointmentDate <= endDateTime;
    });
  }
}
