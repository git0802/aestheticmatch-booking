import { Module } from '@nestjs/common';
import { MindbodyController } from './mindbody.controller';
import { MindbodyService } from './mindbody.service';

@Module({
  controllers: [MindbodyController],
  providers: [MindbodyService],
  exports: [MindbodyService],
})
export class MindbodyModule {}
