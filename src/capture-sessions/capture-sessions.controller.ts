import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CaptureSessionsService } from './capture-sessions.service';

@Controller('capture-sessions')
export class CaptureSessionsController {
  constructor(
    private readonly captureSessionsService: CaptureSessionsService,
  ) {}

  @Get()
  findAll() {
    return this.captureSessionsService.findAll();
  }

  @Get('project/:projectId')
  findByProject(@Param('projectId') projectId: string) {
    return this.captureSessionsService.findByProject(Number(projectId));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.captureSessionsService.findOne(Number(id));
  }

  @Post()
  create(@Body() body: any) {
    return this.captureSessionsService.create(body);
  }
}