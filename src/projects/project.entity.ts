import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne } from 'typeorm';
import { Room } from '../rooms/room.entity';
import { Organization } from '../organizations/organization.entity';

@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @ManyToOne(() => Organization, (org) => org.projects, { nullable: true, onDelete: 'CASCADE' })
  organization!: Organization | null;

  @OneToMany(() => Room, (room) => room.project)
  rooms: Room[];
}
