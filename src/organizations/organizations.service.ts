import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Organization } from './organization.entity';
import { User } from '../users/user.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,

    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async register(orgName: string, email: string, password: string) {
    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const slug = this.toSlug(orgName);
    const baseSlug = slug;
    let finalSlug = slug;
    let attempt = 1;
    while (await this.orgRepo.findOne({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${++attempt}`;
    }

    const org = this.orgRepo.create({ name: orgName, slug: finalSlug });
    const savedOrg = await this.orgRepo.save(org);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({ email, passwordHash, role: 'owner', organization: savedOrg });
    const savedUser = await this.usersRepo.save(user);

    return { org: savedOrg, user: { id: savedUser.id, email: savedUser.email, role: savedUser.role } };
  }

  async inviteUser(orgId: number, email: string, password: string, role = 'member') {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) throw new Error('Organization not found');

    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({ email, passwordHash, role, organization: org });
    const saved = await this.usersRepo.save(user);
    return { id: saved.id, email: saved.email, role: saved.role };
  }

  async getMembers(orgId: number) {
    return this.usersRepo.find({
      where: { organization: { id: orgId } },
      select: ['id', 'email', 'role'],
    });
  }

  async getUsage(orgId: number, projectRepo: Repository<any>) {
    const [memberCount, projectCount] = await Promise.all([
      this.usersRepo.count({ where: { organization: { id: orgId } } }),
      projectRepo.count({ where: { organization: { id: orgId } } }),
    ]);

    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    const includedProjects = (org?.projectLimit ?? 5) * memberCount;
    const extraProjects = Math.max(0, projectCount - includedProjects);
    const monthlyBase = memberCount * (org?.pricePerUser ?? 29.99);
    const monthlyExtras = extraProjects * (org?.pricePerExtraProject ?? 5.0);

    return {
      orgId,
      orgName: org?.name,
      plan: org?.plan ?? 'trial',
      memberCount,
      projectCount,
      includedProjects,
      extraProjects,
      estimatedMonthlyCost: +(monthlyBase + monthlyExtras).toFixed(2),
      breakdown: {
        base: +monthlyBase.toFixed(2),
        extras: +monthlyExtras.toFixed(2),
        pricePerUser: org?.pricePerUser ?? 29.99,
        pricePerExtraProject: org?.pricePerExtraProject ?? 5.0,
      },
    };
  }

  findById(id: number) {
    return this.orgRepo.findOne({ where: { id } });
  }

  async ensureDefaultOrg(): Promise<Organization> {
    let org = await this.orgRepo.findOne({ where: { slug: 'scopetopay' } });
    if (!org) {
      org = this.orgRepo.create({ name: 'ScopetoPay', slug: 'scopetopay', plan: 'pro' });
      org = await this.orgRepo.save(org);
    }
    return org;
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'org';
  }
}
