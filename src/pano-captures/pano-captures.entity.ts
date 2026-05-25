import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class PanoCapture {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  captureSessionId: number;

  @Column({ nullable: true })
  roomId: number;

  @Column()
  fileUrl: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @Column()
  sequenceNumber: number;

  @Column({ type: 'float', nullable: true })
  posX: number;

  @Column({ type: 'float', nullable: true })
  posY: number;

  @Column({ type: 'float', nullable: true })
  headingDegrees: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}