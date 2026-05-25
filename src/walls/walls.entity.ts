import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
} from 'typeorm';
import { Room } from '../rooms/room.entity';

@Entity()
export class Wall {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order: number;

  @Column('float')
  length: number;

  @Column({
    type: 'enum',
    enum: ['up', 'down', 'left', 'right'],
  })
  direction: 'up' | 'down' | 'left' | 'right';

  @ManyToOne(() => Room, (room) => room.walls, { onDelete: 'CASCADE' })
  room: Room;
}