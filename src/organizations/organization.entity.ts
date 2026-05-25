import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Project } from '../projects/project.entity';

@Entity()
export class Organization {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ default: 'trial' })
  plan: string; // 'trial' | 'pro'

  @Column({ type: 'int', default: 5 })
  projectLimit: number;

  @Column({ type: 'float', default: 5.0 })
  pricePerExtraProject: number;

  @Column({ type: 'float', default: 49.99 })
  pricePerUser: number;

  @Column({ type: 'varchar', nullable: true, default: null })
  stripeCustomerId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => Project, (project) => project.organization)
  projects: Project[];
}
