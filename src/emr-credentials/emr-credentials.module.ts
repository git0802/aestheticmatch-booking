import { Module } from '@nestjs/common';
import { EmrCredentialsService } from './emr-credentials.service';
import { EmrCredentialsController } from './emr-credentials.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MindbodyModule } from '../mindbody/mindbody.module';

@Module({
  imports: [PrismaModule, MindbodyModule],
  controllers: [EmrCredentialsController],
  providers: [EmrCredentialsService],
  exports: [EmrCredentialsService],
})
export class EmrCredentialsModule {}
