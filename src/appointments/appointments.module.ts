import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../common/services/encryption.service';
import { MindbodyService } from '../mindbody/mindbody.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, EncryptionService, MindbodyService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
