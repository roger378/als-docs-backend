import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CaptureSession } from './capture-session.entity';
import { Project } from '../projects/project.entity';
import { Room } from '../rooms/room.entity';

@Injectable()
export class CaptureSessionsService {
  constructor(
    @InjectRepository(CaptureSession)
    private readonly captureSessionsRepo: Repository<CaptureSession>,

    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,

    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,
  ) {}

  findAll() {
    return this.captureSessionsRepo.find({
      relations: ['project', 'room'],
      order: { id: 'ASC' },
    });
  }

  findByProject(projectId: number) {
    return this.captureSessionsRepo.find({
      where: {
        project: { id: projectId },
      },
      relations: ['project', 'room'],
      order: { id: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.captureSessionsRepo.findOne({
      where: { id },
      relations: ['project', 'room'],
    });
  }

  async create(body: any) {
    const project = await this.projectsRepo.findOne({
      where: { id: Number(body.projectId) },
    });

    if (!project) {
      return { error: 'Project not found' };
    }

    let room: Room | null = null;
    if (body.roomId) {
      room = await this.roomsRepo.findOne({
        where: { id: Number(body.roomId) },
      });
    }

    const session = this.captureSessionsRepo.create({
      name: body.name?.trim() ? body.name : `Capture Session ${Date.now()}`,
      notes: body.notes ?? '',
      project,
      room: room || null,
    });

    return this.captureSessionsRepo.save(session);
  }
}