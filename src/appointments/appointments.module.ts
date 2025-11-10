import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PracticesModule } from '../practices/practices.module';
import { EncryptionService } from '../common/services/encryption.service';
import { MindbodyService } from '../mindbody/mindbody.service';
import { MindBodyClientService } from '../mindbody/mindbody-client.service';
import { NextechModule } from '../nextech/nextech.module';

@Module({
  imports: [PrismaModule, PracticesModule, NextechModule],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    EncryptionService,
    MindbodyService,
    MindBodyClientService,
  ],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
