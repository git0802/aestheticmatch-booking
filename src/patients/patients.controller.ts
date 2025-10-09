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

@Controller('patients')
// @UseGuards(JwtAuthGuard) // Temporarily disabled for testing
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  async create(
    @Body() createPatientDto: CreatePatientDto,
  ): Promise<PatientResponseDto> {
    return this.patientsService.create(createPatientDto);
  }

  @Get()
  async findAll(
    @Query('skip', new ParseIntPipe({ optional: true })) skip?: number,
    @Query('take', new ParseIntPipe({ optional: true })) take?: number,
    @Query('search') search?: string,
  ): Promise<{
    patients: PatientResponseDto[];
    total: number;
    skip: number;
    take: number;
  }> {
    const whereClause = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

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

  @Get('am-referral/:amReferralId')
  async findByAmReferralId(
    @Param('amReferralId', ParseUUIDPipe) amReferralId: string,
  ): Promise<PatientResponseDto> {
    return this.patientsService.findByAmReferralId(amReferralId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePatientDto: UpdatePatientDto,
  ): Promise<PatientResponseDto> {
    return this.patientsService.update(id, updatePatientDto);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.patientsService.remove(id);
    return { message: 'Patient deleted successfully' };
  }
}
