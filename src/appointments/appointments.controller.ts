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
  ForbiddenException,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import type { User } from '../auth/interfaces/auth.interface';

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.create(createAppointmentDto, user);
  }

  @Get()
  findAll(@Query() query: QueryAppointmentsDto, @GetUser() user: User) {
    return this.appointmentsService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: User) {
    return this.appointmentsService.findOne(id, user);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string, @GetUser() user: User) {
    return this.appointmentsService.findByPatient(patientId, user);
  }

  @Get('practice/:practiceId')
  findByPractice(
    @Param('practiceId') practiceId: string,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.findByPractice(practiceId, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
    @GetUser() user: User,
  ) {
    return this.appointmentsService.update(id, updateAppointmentDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: User) {
    return this.appointmentsService.remove(id, user);
  }

  @Post('update-expired')
  @UseGuards(JwtAuthGuard)
  async updateExpiredAppointments(@GetUser() user: User) {
    // Only allow admin to trigger this manually
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Access denied');
    }
    return this.appointmentsService.updateExpiredAppointments();
  }
}
