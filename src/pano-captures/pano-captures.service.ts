import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PanoCapture } from './pano-captures.entity';

@Injectable()
export class PanoCapturesService {
  constructor(
    @InjectRepository(PanoCapture)
    private readonly repo: Repository<PanoCapture>,
  ) {}

  findAll() {
    return this.repo.find({ order: { id: 'ASC' } });
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  findBySession(captureSessionId: number) {
    return this.repo.find({
      where: { captureSessionId },
      order: { sequenceNumber: 'ASC' },
    });
  }

  findByRoom(roomId: number) {
    return this.repo.find({
      where: { roomId },
      order: { sequenceNumber: 'ASC' },
    });
  }

  create(body: Partial<PanoCapture>) {
    const entity = this.repo.create(body);
    return this.repo.save(entity);
  }

  async update(id: number, body: Partial<PanoCapture>) {
    await this.repo.update(id, body);
    return this.repo.findOne({ where: { id } });
  }

  async remove(id: number) {
    await this.repo.delete(id);
    return { success: true };
  }
}
