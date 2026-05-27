import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { BillingModule } from './billing/billing.module';
import { EmailModule } from './email/email.module';

import { JobsModule } from './jobs/jobs.module';
import { RoomsModule } from './rooms/rooms.module';
import { MediaModule } from './media/module';
import { ObservationsModule } from './observations/observations.module';
import { WallsModule } from './walls/walls.module';
import { CaptureSessionsModule } from './capture-sessions/capture-sessions.module';
import { PanoCapturesModule } from './pano-captures/pano-captures.module';
import { LaserMeasurementsModule } from './laser-measurements/laser-measurements.module';
import { ProjectsModule } from './projects/projects.module';
import { OpeningsModule } from './openings/openings.module';
import { ReferenceJobsModule } from './reference-jobs/reference-jobs.module';
import { PanoAnalysisModule } from './pano-analysis/pano-analysis.module';
import { Insta360Module } from './insta360/insta360.module';
import { ReportsModule } from './reports/reports.module';

import { Room } from './rooms/room.entity';
import { Wall } from './walls/walls.entity';
import { Project } from './projects/project.entity';
import { CaptureSession } from './capture-sessions/capture-session.entity';
import { Media } from './media/media.entity';
import { Opening } from './openings/opening.entity';
import { ReferenceJob } from './reference-jobs/reference-job.entity';
import { PanoCapture } from './pano-captures/pano-captures.entity';
import { LaserMeasurement } from './laser-measurements/laser-measurements.entity';
import { Job } from './jobs/job.entity';
import { Observation } from './observations/observation.entity';
import { User } from './users/user.entity';
import { Organization } from './organizations/organization.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME ?? 'scopetopay',
      entities: [
        Room,
        Wall,
        Project,
        CaptureSession,
        Media,
        Opening,
        ReferenceJob,
        PanoCapture,
        LaserMeasurement,
        Job,
        Observation,
        User,
        Organization,
      ],
      synchronize: true,
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    JobsModule,
    RoomsModule,
    MediaModule,
    ObservationsModule,
    WallsModule,
    CaptureSessionsModule,
    PanoCapturesModule,
    LaserMeasurementsModule,
    ProjectsModule,
    OpeningsModule,
    ReferenceJobsModule,
    PanoAnalysisModule,
    Insta360Module,
    ReportsModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    BillingModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}