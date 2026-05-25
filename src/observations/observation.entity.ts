import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Room } from '../rooms/room.entity';
import { Media } from '../media/media.entity';

@Entity()
export class Observation {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'medium' })
  severity: string;

  @Column({ default: 'open' })
  status: string;

  @ManyToOne(() => Room, room => room.id)
  room: Room;

  @ManyToOne(() => Media, media => media.id, { nullable: true })
  media: Media;
}