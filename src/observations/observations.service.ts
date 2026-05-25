import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observation } from './observation.entity';

@Injectable()
export class ObservationsService {

  constructor(
    @InjectRepository(Observation)
    private repo: Repository<Observation>,
  ) {}

  create(data: Partial<Observation>) {
    const obs = this.repo.create(data);
    return this.repo.save(obs);
  }

  findAll() {
    return this.repo.find({ relations: ['room', 'media'] });
  }

  findByRoom(roomId: number) {
    return this.repo.find({
      where: { room: { id: roomId } },
      relations: ['room', 'media'],
    });
  }
}