import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Media } from './media.entity';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepo: Repository<Media>,
  ) {}

  findAll() {
    return this.mediaRepo.find({
      order: { id: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.mediaRepo.findOne({
      where: { id },
    });
  }

  findByCaptureSession(captureSessionId: number) {
    return this.mediaRepo.find({
      where: { captureSessionId },
      order: { id: 'ASC' },
    });
  }

  async create(body: any) {
    const media = this.mediaRepo.create({
      filename: body.filename,
      originalName: body.originalName,
      mimeType: body.mimeType,
      url: body.url,
      mediaType: body.mediaType ?? 'photo',
      roomId: body.roomId ?? null,
      captureSessionId: body.captureSessionId ?? null,
    });

    return this.mediaRepo.save(media);
  }
}