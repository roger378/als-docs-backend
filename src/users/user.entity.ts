import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Organization } from '../organizations/organization.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ default: 'member' })
  role: string; // 'owner' | 'admin' | 'member'

  @ManyToOne(() => Organization, (org) => org.users, { nullable: true, onDelete: 'CASCADE' })
  organization: Organization | null;
}
