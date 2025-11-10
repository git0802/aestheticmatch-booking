import { Module } from '@nestjs/common';
import { NextechService } from './nextech.service';
import { NextechClientService } from './nextech-client.service';
import { NextechController } from './nextech.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [NextechController],
  providers: [NextechService, NextechClientService, EncryptionService],
  exports: [NextechService, NextechClientService],
})
export class NextechModule {}
