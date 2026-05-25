import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { Organization } from '../organizations/organization.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,

    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  findByEmail(email: string) {
    return this.usersRepo.findOne({ where: { email }, relations: ['organization'] });
  }

  async create(email: string, password: string, org: Organization, role = 'member') {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({ email, passwordHash, role, organization: org });
    return this.usersRepo.save(user);
  }

  async createInOrg(email: string, password: string, orgId: number, role = 'member') {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new Error('Organization not found');
    return this.create(email, password, org, role);
  }

  async updatePassword(userId: number, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.update(userId, { passwordHash });
  }

  async seedAdminUser() {
    const email = process.env.ADMIN_EMAIL ?? 'roger@alsbuilders.com';
    const password = process.env.ADMIN_PASSWORD ?? 'als2024!';

    const existing = await this.usersRepo.findOne({ where: { email }, relations: ['organization'] });

    let org: Organization;
    if (existing?.organization) {
      org = existing.organization;
    } else {
      org = await this.orgRepo.findOne({ where: { slug: 'scopetopay' } }) ?? null as any;
      if (!org) {
        org = this.orgRepo.create({ name: 'ScopetoPay', slug: 'scopetopay', plan: 'pro' });
        org = await this.orgRepo.save(org);
      }
    }

    if (!existing) {
      await this.create(email, password, org, 'owner');
    } else if (!existing.organization) {
      existing.organization = org;
      if (!existing.role || existing.role === 'member') existing.role = 'owner';
      await this.usersRepo.save(existing);
    }
  }
}
