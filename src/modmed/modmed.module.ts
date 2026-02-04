import { Module } from '@nestjs/common';
import { ModmedService } from './modmed.service';
import { ModmedClientService } from './modmed-client.service';
import { ModmedController } from './modmed.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [ModmedController],
  providers: [ModmedService, ModmedClientService, EncryptionService],
  exports: [ModmedService, ModmedClientService],
})
export class ModmedModule {}
