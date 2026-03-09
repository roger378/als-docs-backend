import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomsService {
  private rooms: any[] = [];

  findAll() {
    return this.rooms;
  }
}