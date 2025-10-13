import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { QueryProceduresDto } from './dto/query-procedures.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProceduresService {
  constructor(private prisma: PrismaService) {}

  async create(createProcedureDto: CreateProcedureDto, createdBy: string) {
    try {
      const procedure = await this.prisma.procedure.create({
        data: {
          ...createProcedureDto,
          createdBy,
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

  async findAll(query: QueryProceduresDto) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      feeRule,
      practiceId,
    } = query;

    const skip = (page - 1) * limit;
    const take = limit;

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
      page,
      limit,
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

  async update(
    id: string,
    updateProcedureDto: UpdateProcedureDto,
    updatedBy: string,
  ) {
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
          updatedBy,
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

  async remove(id: string) {
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
