import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Project } from '../projects/project.entity';
import { Wall } from '../walls/walls.entity';

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'float', default: 0 })
  area: number;

  @Column({ type: 'float', nullable: true })
  ceilingHeight: number | null;

  @Column({ type: 'text', nullable: true })
  svg: string | null;

  @ManyToOne(() => Project, (project) => project.rooms, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  project: Project | null;

  @OneToMany(() => Wall, (wall) => wall.room, {
    cascade: true,
  })
  walls: Wall[];

  @Column({ type: 'int', nullable: true })
  draftCaptureSessionId: number | null;

  @Column({ type: 'int', nullable: true })
  draftBasisMediaId: number | null;

  @Column({ type: 'varchar', nullable: true })
  draftRoomType: string | null;

  @Column({ type: 'float', nullable: true })
  draftSuggestedWidth: number | null;

  @Column({ type: 'float', nullable: true })
  draftSuggestedLength: number | null;

  @Column({ type: 'int', nullable: true })
  draftSuggestedWallCount: number | null;

  @Column({ type: 'text', nullable: true })
  draftConfidenceNote: string | null;
}