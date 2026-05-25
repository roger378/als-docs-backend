import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';

import { ReferenceJobsService } from './reference-jobs.service';

@Controller('reference-jobs')
export class ReferenceJobsController {
  constructor(private readonly referenceJobsService: ReferenceJobsService) {}

  @Get()
  findAll() {
    return this.referenceJobsService.findAll();
  }

  @Get('seed/mike-2350-lodi')
  seedMike2350LodiReferenceJob() {
    return this.referenceJobsService.seedMike2350LodiReferenceJob();
  }

  @Get(':id/esx-inspection')
  inspectEsx(@Param('id') id: string) {
    return this.referenceJobsService.inspectEsx(Number(id));
  }

  @Get(':id/xactdoc-inspection')
  inspectXactDoc(@Param('id') id: string) {
    return this.referenceJobsService.inspectXactDoc(Number(id));
  }

  @Get(':id/xactdoc-profile')
  profileXactDoc(@Param('id') id: string) {
    return this.referenceJobsService.profileXactDoc(Number(id));
  }

  @Get(':id/xactdoc-summary')
  summarizeXactDoc(@Param('id') id: string) {
    return this.referenceJobsService.summarizeXactDoc(Number(id));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.referenceJobsService.findOne(Number(id));
  }

  @Post()
  create(@Body() body: any) {
    return this.referenceJobsService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.referenceJobsService.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.referenceJobsService.remove(Number(id));
  }
}