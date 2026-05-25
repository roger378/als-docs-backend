import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wall } from './walls.entity';

@Injectable()
export class WallsService {

  constructor(
    @InjectRepository(Wall)
    private repo: Repository<Wall>,
  ) {}

  create(data: Partial<Wall>) {
    const wall = this.repo.create(data);
    return this.repo.save(wall);
  }

  findByRoom(roomId: number) {
    return this.repo.find({
      where: { room: { id: roomId } },
      order: { order: 'ASC' },
    });
  }

  async patch(id: number, data: { length?: number; direction?: string }) {
    const wall = await this.repo.findOne({ where: { id } });
    if (!wall) return null;
    if (data.length != null) wall.length = data.length;
    if (data.direction != null) wall.direction = data.direction as Wall['direction'];
    return this.repo.save(wall);
  }

}