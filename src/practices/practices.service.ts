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

  private checkAdminRole(user: User) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only administrators can perform this action',
      );
    }
  }

  async create(createPracticeDto: CreatePracticeDto, user: User) {
    this.checkAdminRole(user);

    try {
      const practice = await this.prisma.practice.create({
        data: {
          name: createPracticeDto.name,
          emrType: createPracticeDto.emrType || null,
          connectorConfig: createPracticeDto.connectorConfig || null,
          feeModel: createPracticeDto.feeModel || null,
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

  async findAll() {
    try {
      return await this.prisma.practice.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      throw new BadRequestException('Failed to fetch practices');
    }
  }

  async findOne(id: string) {
    try {
      const practice = await this.prisma.practice.findUnique({
        where: { id },
      });

      if (!practice) {
        throw new NotFoundException('Practice not found');
      }

      return practice;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch practice');
    }
  }

  async update(id: string, updatePracticeDto: UpdatePracticeDto, user: User) {
    this.checkAdminRole(user);

    try {
      // Check if practice exists
      await this.findOne(id);

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
      });

      return practice;
    } catch (error) {
      if (error instanceof NotFoundException) {
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
    this.checkAdminRole(user);

    try {
      // Check if practice exists
      await this.findOne(id);

      await this.prisma.practice.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete practice');
    }
  }
}
