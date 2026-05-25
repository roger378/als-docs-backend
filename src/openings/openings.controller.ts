import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OpeningsService } from './openings.service';

@Controller('openings')
export class OpeningsController {
  constructor(private readonly openingsService: OpeningsService) {}

  @Get()
  findAll() {
    return this.openingsService.findAll();
  }

  @Get('wall/:wallId')
  findByWall(@Param('wallId') wallId: string) {
    return this.openingsService.findByWall(Number(wallId));
  }

  @Delete('by-wall-ids')
  deleteByWallIds(@Body() body: any) {
    return this.openingsService.deleteByWallIds(body.wallIds || []);
  }

  @Post()
  create(@Body() body: any) {
    return this.openingsService.create(body);
  }
}