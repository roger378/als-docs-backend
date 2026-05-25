import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Opening } from './opening.entity';
import { Wall } from '../walls/walls.entity';
import { Room } from '../rooms/room.entity';

@Injectable()
export class OpeningsService {
  constructor(
    @InjectRepository(Opening)
    private readonly openingsRepo: Repository<Opening>,

    @InjectRepository(Wall)
    private readonly wallsRepo: Repository<Wall>,

    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,
  ) {}

  findAll() {
    return this.openingsRepo.find({
      relations: ['wall', 'connectedRoom'],
      order: { id: 'ASC' },
    });
  }

  findByWall(wallId: number) {
    return this.openingsRepo.find({
      where: {
        wall: { id: wallId },
      },
      relations: ['wall', 'connectedRoom'],
      order: { id: 'ASC' },
    });
  }

  async deleteByWallIds(wallIds: number[]) {
    if (!wallIds.length) {
      return { deleted: 0 };
    }

    const openings = await this.openingsRepo.find({
      where: {
        wall: {
          id: In(wallIds),
        },
      },
      relations: ['wall'],
    });

    if (!openings.length) {
      return { deleted: 0 };
    }

    await this.openingsRepo.remove(openings);
    return { deleted: openings.length };
  }

  async create(body: any) {
    const wall = await this.wallsRepo.findOne({
      where: { id: Number(body.wallId) },
    });

    if (!wall) {
      return { error: 'Wall not found' };
    }

    let connectedRoom: Room | null = null;
    if (body.connectedRoomId) {
      connectedRoom = await this.roomsRepo.findOne({
        where: { id: Number(body.connectedRoomId) },
      });
    }

    const opening = this.openingsRepo.create({
      wall,
      type: body.type ?? 'door',
      offsetFromWallStart: Number(body.offsetFromWallStart ?? 0),
      width: Number(body.width ?? 0),
      height: body.height != null ? Number(body.height) : null,
      sillHeight: body.sillHeight != null ? Number(body.sillHeight) : null,
      isExterior: Boolean(body.isExterior),
      connectedRoom: connectedRoom || null,
    });

    return this.openingsRepo.save(opening);
  }
}