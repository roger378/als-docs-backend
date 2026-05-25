import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PanoCapturesService } from './pano-captures.service';
import { PanoCapture } from './pano-captures.entity';

@Controller('pano-captures')
export class PanoCapturesController {
  constructor(private readonly service: PanoCapturesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('session/:captureSessionId')
  findBySession(@Param('captureSessionId') id: string) {
    return this.service.findBySession(Number(id));
  }

  @Get('room/:roomId')
  findByRoom(@Param('roomId') id: string) {
    return this.service.findByRoom(Number(id));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Post()
  create(@Body() body: Partial<PanoCapture>) {
    return this.service.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<PanoCapture>) {
    return this.service.update(Number(id), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
