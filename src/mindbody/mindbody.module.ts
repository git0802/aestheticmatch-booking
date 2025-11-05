import { Module } from '@nestjs/common';
import { MindbodyController } from './mindbody.controller';
import { MindbodyService } from './mindbody.service';
import { MindBodyClientService } from './mindbody-client.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [MindbodyController],
  providers: [MindbodyService, MindBodyClientService, EncryptionService],
  exports: [MindbodyService, MindBodyClientService],
})
export class MindbodyModule {}
