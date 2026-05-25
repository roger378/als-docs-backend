import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { MediaService } from './service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  findAll() {
    return this.mediaService.findAll();
  }

  @Get('capture-session/:captureSessionId')
  findByCaptureSession(@Param('captureSessionId') captureSessionId: string) {
    return this.mediaService.findByCaptureSession(Number(captureSessionId));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(Number(id));
  }

  @Post()
  create(@Body() body: any) {
    return this.mediaService.create(body);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, callback) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
          callback(null, uniqueName);
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (!file) {
      return { error: 'No file uploaded' };
    }

    return this.mediaService.create({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      url: `/uploads/${file.filename}`,
      mediaType: body.mediaType ?? 'photo',
      roomId: body.roomId ? Number(body.roomId) : null,
      captureSessionId: body.captureSessionId
        ? Number(body.captureSessionId)
        : null,
    });
  }
}