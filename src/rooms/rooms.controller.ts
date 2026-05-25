import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll() {
    return this.roomsService.findAll();
  }

  @Get('project/:projectId')
  findByProject(@Param('projectId') projectId: string) {
    return this.roomsService.findByProject(Number(projectId));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomsService.findOne(Number(id));
  }

  @Get(':id/full')
  findOneWithWalls(@Param('id') id: string) {
    return this.roomsService.findOneWithWalls(Number(id));
  }

  @Get(':id/walls')
  getRoomWalls(@Param('id') id: string) {
    return this.roomsService.getRoomWalls(Number(id));
  }

  @Get(':id/export-payload')
  getExportPayload(@Param('id') id: string) {
    return this.roomsService.getNormalizedExportPayload(Number(id));
  }

  @Post('save')
  saveRoomFromWalls(@Body() body: any) {
    return this.roomsService.create(body);
  }

  @Put(':id')
  updateRoomFromWalls(@Param('id') id: string, @Body() body: any) {
    return this.roomsService.update(Number(id), body);
  }

  @Post('generate-from-capture')
  generateFromCapture(@Body() body: any) {
    return this.roomsService.generateFromCapture(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.roomsService.remove(Number(id));
  }
}