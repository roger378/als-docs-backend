import { Body, Controller, Delete, Get, Param, Post, Put, Request } from '@nestjs/common';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  private orgId(req: any): number | undefined {
    return req.user?.organization?.id ?? undefined;
  }

  @Get()
  findAll(@Request() req: any) {
    return this.projectsService.findAll(this.orgId(req));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.findOne(Number(id), this.orgId(req));
  }

  @Post()
  create(@Body() body: any, @Request() req: any) {
    const org = req.user?.organization ?? null;
    return this.projectsService.create(body, org);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.projectsService.update(Number(id), body, this.orgId(req));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.remove(Number(id), this.orgId(req));
  }
}
