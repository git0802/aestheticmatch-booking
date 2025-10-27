import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  PatientResponseDto,
} from './dto/patients.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { User } from '../auth/interfaces/auth.interface';

@Controller('patients')
@UseGuards(JwtAuthGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  async create(
    @Body() createPatientDto: CreatePatientDto,
    @GetUser() user: User,
  ): Promise<PatientResponseDto> {
    return this.patientsService.create(createPatientDto, user.id);
  }

  @Get()
  async findAll(
    @GetUser() user: User,
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('search') search?: string,
    @Query('createdBy') createdBy?: string,
  ): Promise<{
    patients: PatientResponseDto[];
    total: number;
    skip: number;
    take: number;
  }> {
    const searchClause = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Apply role-based filtering
    const roleClause =
      user.role === 'CONCIERGE'
        ? { createdBy: user.id } // CONCIERGE users only see patients they created
        : {}; // Other roles see all patients

    // Apply createdBy filter if provided (only for non-CONCIERGE users)
    const createdByClause =
      user.role !== 'CONCIERGE' && createdBy ? { createdBy } : {};

    // Combine search, role, and createdBy filtering
    const whereClause = {
      ...searchClause,
      ...roleClause,
      ...createdByClause,
    };

    const [patients, total] = await Promise.all([
      this.patientsService.findAll({
        skip: skip || 0,
        take: take || 50,
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      }),
      this.patientsService.count(whereClause),
    ]);

    return {
      patients,
      total,
      skip: skip || 0,
      take: take || 50,
    };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PatientResponseDto> {
    return this.patientsService.findOne(id);
  }

  @Get('email/:email')
  async findByEmail(
    @Param('email') email: string,
  ): Promise<PatientResponseDto> {
    return this.patientsService.findByEmail(email);
  }

  // Route to find by AM Referral ID removed

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePatientDto: UpdatePatientDto,
    @GetUser() user: User,
  ): Promise<PatientResponseDto> {
    return this.patientsService.update(id, updatePatientDto, user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.patientsService.remove(id);
    return { message: 'Patient deleted successfully' };
  }
}
