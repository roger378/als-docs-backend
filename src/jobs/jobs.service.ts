import { Injectable } from '@nestjs/common';

@Injectable()
export class JobsService {

  private jobs: any[] = [];

  create(jobData: any) {
    const newJob = {
      id: Date.now(),
      ...jobData,
      rooms: [],
      photos: [],
      createdAt: new Date()
    };

    this.jobs.push(newJob);
    return newJob;
  }

  findAll() {
    return this.jobs;
  }

}
