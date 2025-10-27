import { Module } from '@nestjs/common';
import { PracticesService } from './practices.service';
import { PracticesController } from './practices.controller';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { MindbodyValidationService } from '../common/services/mindbody-validation.service';

@Module({
  controllers: [PracticesController],
  providers: [
    PracticesService,
    PrismaService,
    EncryptionService,
    MindbodyValidationService,
  ],
  exports: [PracticesService],
})
export class PracticesModule {}
