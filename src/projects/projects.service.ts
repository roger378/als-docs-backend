import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { Organization } from '../organizations/organization.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
  ) {}

  findAll(orgId?: number) {
    return this.projectsRepo.find({
      where: orgId ? { organization: { id: orgId } } : {},
      relations: ['rooms'],
      order: { id: 'ASC' },
    });
  }

  findOne(id: number, orgId?: number) {
    return this.projectsRepo.findOne({
      where: orgId ? { id, organization: { id: orgId } } : { id },
      relations: ['rooms'],
    });
  }

  async create(body: any, org?: Organization | null) {
    if (org) {
      const count = await this.projectsRepo.count({ where: { organization: { id: org.id } } });
      if (org.plan === 'trial' && count >= 1) {
        throw new HttpException(
          'Trial plan is limited to 1 project. Upgrade to Pro to create more.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      if (org.plan !== 'trial' && count >= org.projectLimit) {
        throw new HttpException(
          `Project limit of ${org.projectLimit} reached. Add more seats to increase your limit.`,
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }
    const project = this.projectsRepo.create({
      name: body.name,
      address: body.address ?? null,
      organization: org ?? null,
    });
    return this.projectsRepo.save(project);
  }

  async update(id: number, body: any, orgId?: number) {
    const project = await this.findOne(id, orgId);
    if (!project) return { error: 'Project not found' };
    project.name = body.name ?? project.name;
    project.address = body.address ?? project.address ?? null;
    await this.projectsRepo.save(project);
    return this.findOne(id, orgId);
  }

  async remove(id: number, orgId?: number) {
    const project = await this.findOne(id, orgId);
    if (!project) return { error: 'Project not found' };
    await this.projectsRepo.delete(id);
    return { success: true };
  }
}
