import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { ProceduresModule } from './procedures/procedures.module';
import { PracticesModule } from './practices/practices.module';
import { MindbodyModule } from './mindbody/mindbody.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    PatientsModule,
    ProceduresModule,
    PracticesModule,
    MindbodyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
