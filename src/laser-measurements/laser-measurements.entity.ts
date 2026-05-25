import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class LaserMeasurement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  captureSessionId: number;

  @Column({ nullable: true })
  roomId: number;

  @Column({ nullable: true })
  panoCaptureId: number;

  @Column('float')
  distance: number;

  @Column({ type: 'float', nullable: true })
  angleDegrees: number;

  @Column({ nullable: true })
  directionLabel: string;

  @Column({ nullable: true })
  measurementType: string;

  @Column({ type: 'json', nullable: true })
  rawPayloadJson: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}