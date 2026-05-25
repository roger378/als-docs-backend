import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Media {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column()
  url: string;

  @Column({ type: 'varchar', default: 'photo' })
  mediaType: string;

  @Column({ type: 'int', nullable: true })
  roomId: number | null;

  @Column({ type: 'int', nullable: true })
  captureSessionId: number | null;
}