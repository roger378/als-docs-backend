import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Project } from '../projects/project.entity';
import { Room } from '../rooms/room.entity';

@Entity()
export class CaptureSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Project, { nullable: false, onDelete: 'CASCADE' })
  project: Project;

  @ManyToOne(() => Room, { nullable: true, onDelete: 'SET NULL' })
  room: Room | null;
}