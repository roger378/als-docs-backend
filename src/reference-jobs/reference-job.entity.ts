import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ReferenceJob {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', default: 'esx-pano-reference' })
  sourceType: string;

  @Column({ type: 'varchar', nullable: true })
  esxFileName: string | null;

  @Column({ type: 'varchar', nullable: true })
  esxOriginalName: string | null;

  @Column({ type: 'varchar', nullable: true })
  esxStoragePath: string | null;

  @Column({ type: 'int', default: 0 })
  panoCount: number;

  @Column({ type: 'simple-json', nullable: true })
  panoFiles: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  cameraModel: string | null;

  @Column({ type: 'varchar', nullable: true })
  captureDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  projectLabel: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any> | null;
}