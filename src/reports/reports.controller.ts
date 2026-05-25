import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('project/:id')
  async projectReport(@Param('id') id: string, @Res() res: Response) {
    try {
      const html = await this.reportsService.buildProjectReport(Number(id));
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err: any) {
      res.status(404).json({ error: err?.message ?? 'Report failed' });
    }
  }

  @Get('project/:id/xactimate')
  async xactimateExport(@Param('id') id: string, @Res() res: Response) {
    try {
      const xml = await this.reportsService.buildXactimateXml(Number(id));
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="project-${id}-xactimate.xml"`);
      res.send(xml);
    } catch (err: any) {
      res.status(404).json({ error: err?.message ?? 'Export failed' });
    }
  }
}
