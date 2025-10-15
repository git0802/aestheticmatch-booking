import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePracticeDto } from './dto/create-practice.dto';
import { UpdatePracticeDto } from './dto/update-practice.dto';
import { Prisma } from '@prisma/client';
import type { User } from '../auth/interfaces/auth.interface';

@Injectable()
export class PracticesService {
  constructor(private prisma: PrismaService) {}

  async create(createPracticeDto: CreatePracticeDto, user: User) {
    // Allow ADMIN and CONCIERGE to create practices
    if (!user.role || !['ADMIN', 'CONCIERGE'].includes(user.role)) {
      throw new ForbiddenException(
        'Only admin and concierge users can create practices',
      );
    }

    try {
      const practice = await this.prisma.practice.create({
        data: {
          name: createPracticeDto.name,
          emrType: createPracticeDto.emrType || null,
          connectorConfig: createPracticeDto.connectorConfig || null,
          feeModel: createPracticeDto.feeModel || null,
          createdBy: user.id,
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
