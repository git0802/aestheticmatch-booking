import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProcedureDto,
  UpdateFeeSettingsDto,
} from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { QueryProceduresDto } from './dto/query-procedures.dto';
import { Prisma } from '@prisma/client';
import type { User } from '../auth/interfaces/auth.interface';

@Injectable()
export class ProceduresService {
  constructor(private prisma: PrismaService) {}

  private checkAdminRole(user: User) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only administrators can perform this action',
      );
    }
  }

  async create(createProcedureDto: CreateProcedureDto, user: User) {
    this.checkAdminRole(user);

    try {
      const procedure = await this.prisma.procedure.create({
        data: {
          ...createProcedureDto,
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
          updatedByUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return procedure;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'A procedure with this name already exists',
          );
        }
      }
      throw error;
    }
  }

  // Global Fee Settings
  private async getOrCreateFeeSettings() {
    const existing = await this.prisma.feeSettings.findFirst();
    if (existing) return existing;
    return this.prisma.feeSettings.create({
      data: {
        consultFee: 0,
        surgeryFee: 0,
        nonSurgicalFee: 0,
      },
    });
  }

  async getFeeSettings() {
    return this.getOrCreateFeeSettings();
  }

  async updateFeeSettings(dto: UpdateFeeSettingsDto, user: User) {
    this.checkAdminRole(user);
    const settings = await this.getOrCreateFeeSettings();
    return this.prisma.feeSettings.update({
      where: { id: settings.id },
      data: {
        ...(dto.consultFee !== undefined && { consultFee: dto.consultFee }),
        ...(dto.surgeryFee !== undefined && { surgeryFee: dto.surgeryFee }),
        ...(dto.nonSurgicalFee !== undefined && {
          nonSurgicalFee: dto.nonSurgicalFee,
        }),
      },
    });
  }

  async findAll(query: QueryProceduresDto) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      feeRule,
      practiceId,
    } = query;

    // Ensure page and limit are numbers and have sensible defaults
    const pageNum = Number(page) || 1;
    const limitNum = Math.min(Number(limit) || 20, 100); // Cap at 100 items per page

    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const where: Prisma.ProcedureWhereInput = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (category) {
      where.category = category;
    }

    if (feeRule) {
      where.defaultFeeRule = feeRule;
    }

    if (practiceId) {
      where.linkedPractices = {
        has: practiceId,
      };
    }

    const [procedures, total] = await Promise.all([
      this.prisma.procedure.findMany({
        where,
        skip,
        take,
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
          updatedByUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.procedure.count({ where }),
    ]);

    return {
      procedures,
      total,
      page: pageNum,
      limit: limitNum,
    };
  }

  async findOne(id: string) {
    const procedure = await this.prisma.procedure.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updatedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!procedure) {
      throw new NotFoundException('Procedure not found');
    }

    return procedure;
  }

  async findByPractice(practiceId: string) {
    const procedures = await this.prisma.procedure.findMany({
      where: {
        linkedPractices: {
          has: practiceId,
        },
      },
      orderBy: {
        name: 'asc',
      },
      include: {
        createdByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updatedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return procedures;
  }

  async update(id: string, updateProcedureDto: UpdateProcedureDto, user: User) {
    this.checkAdminRole(user);

    const existingProcedure = await this.prisma.procedure.findUnique({
      where: { id },
    });

    if (!existingProcedure) {
      throw new NotFoundException('Procedure not found');
    }

    try {
      const procedure = await this.prisma.procedure.update({
        where: { id },
        data: {
          ...updateProcedureDto,
          updatedBy: user.id,
        },
        include: {
          createdByUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          updatedByUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return procedure;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'A procedure with this name already exists',
          );
        }
      }
      throw error;
    }
  }

  async remove(id: string, user: User) {
    this.checkAdminRole(user);

    const existingProcedure = await this.prisma.procedure.findUnique({
      where: { id },
    });

    if (!existingProcedure) {
      throw new NotFoundException('Procedure not found');
    }

    await this.prisma.procedure.delete({
      where: { id },
    });

    return { message: 'Procedure deleted successfully' };
  }
}
