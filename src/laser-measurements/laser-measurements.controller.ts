import { Controller, Get, Post, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LaserMeasurement } from './laser-measurements.entity';

@Controller('laser-measurements')
export class LaserMeasurementsController {
  constructor(
    @InjectRepository(LaserMeasurement)
    private readonly repo: Repository<LaserMeasurement>,
  ) {}

  @Get()
  findAll() {
    return this.repo.find({
      order: { id: 'ASC' },
    });
  }

  @Post()
  create(@Body() body: Partial<LaserMeasurement>) {
    const measurement = this.repo.create(body);
    return this.repo.save(measurement);
  }
}