import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Wall } from '../walls/walls.entity';
import { Room } from '../rooms/room.entity';

@Entity()
export class Opening {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Wall, { nullable: false, onDelete: 'CASCADE' })
  wall: Wall;

  @Column({ type: 'varchar' })
  type: string; // door, window, opening, garage_door, cased_opening

  @Column({ type: 'float', default: 0 })
  offsetFromWallStart: number;

  @Column({ type: 'float', default: 0 })
  width: number;

  @Column({ type: 'float', nullable: true })
  height: number | null;

  @Column({ type: 'float', nullable: true })
  sillHeight: number | null;

  @Column({ type: 'boolean', default: false })
  isExterior: boolean;

  @ManyToOne(() => Room, { nullable: true, onDelete: 'SET NULL' })
  connectedRoom: Room | null;
}