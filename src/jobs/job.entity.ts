import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class Job {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  address: string;

  @Column({ nullable: true })
  client: string;

  @Column({ nullable: true })
  claimNumber: string;

  @Column({ nullable: true })
  adjuster: string;

  @CreateDateColumn()
  createdAt: Date;

}