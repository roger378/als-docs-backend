import { Controller, Get, Post, Body } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {

  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() jobData: any) {
    return this.jobsService.create(jobData);
  }

  @Get()
  findAll() {
    return this.jobsService.findAll();
  }

}

