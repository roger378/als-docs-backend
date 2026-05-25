import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './room.entity';
import { Wall } from '../walls/walls.entity';
import { Project } from '../projects/project.entity';
import { LaserMeasurement } from '../laser-measurements/laser-measurements.entity';

type WallInput = {
  order: number;
  length: number;
  direction: 'right' | 'left' | 'up' | 'down';
};

type Point = {
  x: number;
  y: number;
};

type ExportValidationResult = {
  isExportReady: boolean;
  errorCount: number;
  warningCount: number;
  errors: string[];
  warnings: string[];
};

// Maps direction labels from laser devices to cardinal wall directions
const DIRECTION_MAP: Record<string, { axis: 'x' | 'y'; sign: 1 | -1 }> = {
  north: { axis: 'y', sign: 1 },
  n: { axis: 'y', sign: 1 },
  front: { axis: 'y', sign: 1 },
  forward: { axis: 'y', sign: 1 },
  south: { axis: 'y', sign: -1 },
  s: { axis: 'y', sign: -1 },
  back: { axis: 'y', sign: -1 },
  backward: { axis: 'y', sign: -1 },
  east: { axis: 'x', sign: 1 },
  e: { axis: 'x', sign: 1 },
  right: { axis: 'x', sign: 1 },
  west: { axis: 'x', sign: -1 },
  w: { axis: 'x', sign: -1 },
  left: { axis: 'x', sign: -1 },
};

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,

    @InjectRepository(Wall)
    private readonly wallsRepo: Repository<Wall>,

    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,

    @InjectRepository(LaserMeasurement)
    private readonly laserRepo: Repository<LaserMeasurement>,
  ) {}

  findAll() {
    return this.roomsRepo.find({
      relations: ['walls', 'project'],
      order: { id: 'ASC' },
    });
  }

  findOne(id: number) {
    return this.roomsRepo.findOne({
      where: { id },
      relations: ['walls', 'project'],
    });
  }

  findOneWithWalls(id: number) {
    return this.roomsRepo.findOne({
      where: { id },
      relations: ['walls', 'project'],
    });
  }

  findByProject(projectId: number) {
    return this.roomsRepo.find({
      where: {
        project: { id: projectId },
      },
      relations: ['walls', 'project'],
      order: { id: 'ASC' },
    });
  }

  async getRoomWalls(id: number) {
    const room = await this.roomsRepo.findOne({
      where: { id },
      relations: ['walls', 'project'],
    });

    if (!room) {
      return [];
    }

    return room.walls || [];
  }

  private normalizeWalls(walls: any[]): WallInput[] {
    if (!Array.isArray(walls)) return [];

    return walls
      .map((wall, index) => ({
        order: wall?.order != null ? Number(wall.order) : index + 1,
        length: Number(wall?.length ?? 0),
        direction: wall?.direction,
      }))
      .filter(
        (wall) =>
          Number.isFinite(wall.length) &&
          wall.length > 0 &&
          ['right', 'left', 'up', 'down'].includes(String(wall.direction)),
      )
      .sort((a, b) => a.order - b.order);
  }

  private buildPointsFromWalls(walls: WallInput[]): Point[] {
    const points: Point[] = [{ x: 0, y: 0 }];
    let x = 0;
    let y = 0;

    for (const wall of walls) {
      switch (wall.direction) {
        case 'right':
          x += wall.length;
          break;
        case 'left':
          x -= wall.length;
          break;
        case 'up':
          y += wall.length;
          break;
        case 'down':
          y -= wall.length;
          break;
      }

      points.push({ x, y });
    }

    return points;
  }

  private polygonArea(points: Point[]): number {
    if (points.length < 4) return 0;

    let area = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      area += p1.x * p2.y - p2.x * p1.y;
    }

    return Math.abs(area) / 2;
  }

  private buildSvg(points: Point[]): string | null {
    if (points.length < 2) return null;

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 20;
    const scale = 20;

    const width = Math.max(120, (maxX - minX) * scale + padding * 2);
    const height = Math.max(120, (maxY - minY) * scale + padding * 2);

    const svgPoints = points.map((p) => {
      const px = (p.x - minX) * scale + padding;
      const py = height - ((p.y - minY) * scale + padding);
      return `${px},${py}`;
    });

    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="white" />
  <polyline
    points="${svgPoints.join(' ')}"
    fill="rgba(59,130,246,0.10)"
    stroke="#111827"
    stroke-width="3"
  />
</svg>`.trim();
  }

  private computeGeometry(wallsInput: any[]) {
    const walls = this.normalizeWalls(wallsInput);

    if (!walls.length) {
      return {
        walls,
        area: 0,
        svg: null as string | null,
      };
    }

    const points = this.buildPointsFromWalls(walls);
    const area = this.polygonArea(points);
    const svg = this.buildSvg(points);

    return {
      walls,
      area,
      svg,
    };
  }

  async create(body: any) {
    let project: Project | null = null;

    if (body.projectId) {
      project = await this.projectsRepo.findOne({
        where: { id: Number(body.projectId) },
      });
    }

    const geometry = this.computeGeometry(body.walls);

    const room = this.roomsRepo.create({
      name: body.name,
      area: geometry.area,
      ceilingHeight:
        body.ceilingHeight != null ? Number(body.ceilingHeight) : null,
      svg: geometry.svg,
      project: project || null,
      draftCaptureSessionId:
        body.draftCaptureSessionId != null
          ? Number(body.draftCaptureSessionId)
          : null,
      draftBasisMediaId:
        body.draftBasisMediaId != null
          ? Number(body.draftBasisMediaId)
          : null,
      draftRoomType: body.draftRoomType ?? null,
      draftSuggestedWidth:
        body.draftSuggestedWidth != null
          ? Number(body.draftSuggestedWidth)
          : null,
      draftSuggestedLength:
        body.draftSuggestedLength != null
          ? Number(body.draftSuggestedLength)
          : null,
      draftSuggestedWallCount:
        body.draftSuggestedWallCount != null
          ? Number(body.draftSuggestedWallCount)
          : null,
      draftConfidenceNote: body.draftConfidenceNote ?? null,
    });

    const savedRoom = await this.roomsRepo.save(room);

    if (geometry.walls.length > 0) {
      const wallEntities = geometry.walls.map((wall) =>
        this.wallsRepo.create({
          room: savedRoom,
          order: wall.order,
          length: Number(wall.length),
          direction: wall.direction,
        }),
      );

      await this.wallsRepo.save(wallEntities);
    }

    return this.roomsRepo.findOne({
      where: { id: savedRoom.id },
      relations: ['walls', 'project'],
    });
  }

  async update(id: number, body: any) {
    const room = await this.roomsRepo.findOne({
      where: { id },
      relations: ['walls', 'project'],
    });

    if (!room) {
      return { error: 'Room not found' };
    }

    let project: Project | null = null;

    if (body.projectId) {
      project = await this.projectsRepo.findOne({
        where: { id: Number(body.projectId) },
      });
    }

    const geometry = this.computeGeometry(body.walls);

    room.name = body.name ?? room.name;
    room.area = geometry.area;
    room.ceilingHeight =
      body.ceilingHeight != null ? Number(body.ceilingHeight) : null;
    room.svg = geometry.svg;
    room.project = project || null;
    room.draftCaptureSessionId =
      body.draftCaptureSessionId != null
        ? Number(body.draftCaptureSessionId)
        : null;
    room.draftBasisMediaId =
      body.draftBasisMediaId != null ? Number(body.draftBasisMediaId) : null;
    room.draftRoomType = body.draftRoomType ?? null;
    room.draftSuggestedWidth =
      body.draftSuggestedWidth != null
        ? Number(body.draftSuggestedWidth)
        : null;
    room.draftSuggestedLength =
      body.draftSuggestedLength != null
        ? Number(body.draftSuggestedLength)
        : null;
    room.draftSuggestedWallCount =
      body.draftSuggestedWallCount != null
        ? Number(body.draftSuggestedWallCount)
        : null;
    room.draftConfidenceNote = body.draftConfidenceNote ?? null;

    await this.roomsRepo.save(room);

    await this.wallsRepo.delete({
      room: { id: room.id } as any,
    });

    if (geometry.walls.length > 0) {
      const wallEntities = geometry.walls.map((wall) =>
        this.wallsRepo.create({
          room,
          order: wall.order,
          length: Number(wall.length),
          direction: wall.direction,
        }),
      );

      await this.wallsRepo.save(wallEntities);
    }

    return this.roomsRepo.findOne({
      where: { id: room.id },
      relations: ['walls', 'project'],
    });
  }

  private buildExportValidation(
    room: Room,
    normalizedWalls: any[],
  ): ExportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const roomArea = Number(room.area ?? 0);

    if (!room.name || String(room.name).trim() === '') {
      warnings.push('Room is missing a name.');
    }

    if (!Number.isFinite(roomArea) || roomArea <= 0) {
      errors.push('Room area is missing or zero.');
    }

    if (room.ceilingHeight == null || Number(room.ceilingHeight) <= 0) {
      warnings.push('Room ceiling height is missing or zero.');
    }

    if (!room.svg) {
      warnings.push('Room SVG sketch is missing.');
    }

    if (!Array.isArray(normalizedWalls) || normalizedWalls.length === 0) {
      errors.push('Room has no walls.');
    }

    for (const wall of normalizedWalls) {
      const wallLabel = `Wall ${wall.order ?? wall.id ?? 'unknown'}`;
      const wallLength = Number(wall.length ?? 0);

      if (!Number.isFinite(wallLength) || wallLength <= 0) {
        errors.push(`${wallLabel} has missing or invalid length.`);
      }

      if (!['right', 'left', 'up', 'down'].includes(String(wall.direction))) {
        errors.push(`${wallLabel} has missing or invalid direction.`);
      }

      const openings = Array.isArray(wall.openings) ? wall.openings : [];

      for (const opening of openings) {
        const openingLabel = `${wallLabel} opening ${
          opening.id ?? 'unknown'
        }`;

        const openingWidth = Number(opening.width ?? 0);
        const openingOffset = Number(opening.offsetFromWallStart ?? 0);

        if (!opening.type) {
          errors.push(`${openingLabel} is missing type.`);
        }

        if (!Number.isFinite(openingWidth) || openingWidth <= 0) {
          errors.push(`${openingLabel} has missing or invalid width.`);
        }

        if (!Number.isFinite(openingOffset) || openingOffset < 0) {
          errors.push(`${openingLabel} has invalid offset from wall start.`);
        }

        if (
          Number.isFinite(wallLength) &&
          wallLength > 0 &&
          Number.isFinite(openingOffset) &&
          Number.isFinite(openingWidth) &&
          openingOffset + openingWidth > wallLength
        ) {
          errors.push(`${openingLabel} extends past the end of its wall.`);
        }

        if (
          ['door', 'window', 'garage_door'].includes(String(opening.type)) &&
          (opening.height == null || Number(opening.height) <= 0)
        ) {
          warnings.push(`${openingLabel} is missing height.`);
        }

        if (String(opening.type) === 'window' && opening.sillHeight == null) {
          warnings.push(`${openingLabel} is a window but has no sill height.`);
        }

        if (
          opening.isExterior === false &&
          ['opening', 'cased_opening'].includes(String(opening.type)) &&
          opening.connectedRoom == null
        ) {
          warnings.push(
            `${openingLabel} is interior but has no connected room.`,
          );
        }
      }
    }

    return {
      isExportReady: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
    };
  }

  async getNormalizedExportPayload(id: number) {
    const room = await this.roomsRepo.findOne({
      where: { id },
      relations: ['walls', 'project'],
    });

    if (!room) {
      return { error: 'Room not found' };
    }

    const walls = (room.walls || []).sort((a: any, b: any) => {
      const aOrder = a.order ?? 0;
      const bOrder = b.order ?? 0;
      return aOrder - bOrder;
    });

    const wallIds = walls.map((wall: any) => wall.id).filter(Boolean);

    let openingsByWallId: Record<number, any[]> = {};

    if (wallIds.length > 0) {
      const openings = await this.wallsRepo.manager
        .createQueryBuilder()
        .select('o.id', 'id')
        .addSelect('o.type', 'type')
        .addSelect('o.offsetFromWallStart', 'offsetFromWallStart')
        .addSelect('o.width', 'width')
        .addSelect('o.height', 'height')
        .addSelect('o.sillHeight', 'sillHeight')
        .addSelect('o.isExterior', 'isExterior')
        .addSelect('o.wallId', 'wallId')
        .addSelect('o.connectedRoomId', 'connectedRoomId')
        .addSelect('connectedRoom.name', 'connectedRoomName')
        .from('opening', 'o')
        .leftJoin(
          'room',
          'connectedRoom',
          'connectedRoom.id = o.connectedRoomId',
        )
        .where('o.wallId IN (:...wallIds)', { wallIds })
        .orderBy('o.wallId', 'ASC')
        .addOrderBy('o.id', 'ASC')
        .getRawMany();

      openingsByWallId = openings.reduce(
        (acc: Record<number, any[]>, opening: any) => {
          const wallId = Number(opening.wallId);

          if (!acc[wallId]) acc[wallId] = [];

          acc[wallId].push({
            id: Number(opening.id),
            type: opening.type,
            offsetFromWallStart: Number(opening.offsetFromWallStart ?? 0),
            width: Number(opening.width ?? 0),
            height: opening.height != null ? Number(opening.height) : null,
            sillHeight:
              opening.sillHeight != null ? Number(opening.sillHeight) : null,
            isExterior: Boolean(opening.isExterior),
            connectedRoom:
              opening.connectedRoomId != null
                ? {
                    id: Number(opening.connectedRoomId),
                    name: opening.connectedRoomName ?? null,
                  }
                : null,
          });

          return acc;
        },
        {},
      );
    }

    const normalizedWalls = walls.map((wall: any) => ({
      id: wall.id,
      order: wall.order ?? null,
      length: Number(wall.length ?? 0),
      direction: wall.direction,
      openings: openingsByWallId[wall.id] || [],
    }));

    const totals = normalizedWalls.reduce(
      (acc, wall) => {
        acc.wallCount += 1;
        acc.totalWallLength += Number(wall.length ?? 0);
        acc.openingCount += wall.openings.length;

        for (const opening of wall.openings) {
          acc.totalOpeningWidth += Number(opening.width ?? 0);
        }

        return acc;
      },
      {
        wallCount: 0,
        openingCount: 0,
        totalWallLength: 0,
        totalOpeningWidth: 0,
      },
    );

    const validation = this.buildExportValidation(room, normalizedWalls);

    return {
      exportVersion: 1,
      exportType: 'normalized-room',
      room: {
        id: room.id,
        name: room.name,
        area: Number(room.area ?? 0),
        ceilingHeight:
          room.ceilingHeight != null ? Number(room.ceilingHeight) : null,
        svg: room.svg ?? null,
      },
      project: room.project
        ? {
            id: room.project.id,
            name: room.project.name,
            address: room.project.address ?? null,
          }
        : null,
      geometry: {
        wallCount: totals.wallCount,
        openingCount: totals.openingCount,
        totalWallLength: totals.totalWallLength,
        totalOpeningWidth: totals.totalOpeningWidth,
        walls: normalizedWalls,
      },
      validation,
      draft: {
        captureSessionId: room.draftCaptureSessionId ?? null,
        basisMediaId: room.draftBasisMediaId ?? null,
        roomType: room.draftRoomType ?? null,
        suggestedWidth:
          room.draftSuggestedWidth != null
            ? Number(room.draftSuggestedWidth)
            : null,
        suggestedLength:
          room.draftSuggestedLength != null
            ? Number(room.draftSuggestedLength)
            : null,
        suggestedWallCount:
          room.draftSuggestedWallCount != null
            ? Number(room.draftSuggestedWallCount)
            : null,
        confidenceNote: room.draftConfidenceNote ?? null,
      },
    };
  }

  async saveRoomFromWalls(body: any) {
    return this.create(body);
  }

  async updateRoomFromWalls(id: number, body: any) {
    return this.update(id, body);
  }

  async generateFromCapture(body: {
    captureSessionId: number;
    projectId?: number;
    roomName?: string;
    ceilingHeight?: number;
  }) {
    const measurements = await this.laserRepo.find({
      where: { captureSessionId: body.captureSessionId },
    });

    if (!measurements.length) {
      return {
        error: 'No laser measurements found for this capture session.',
        hint: 'Use POST /pano-analysis/analyze-and-create-room to generate a room from a panoramic image instead.',
      };
    }

    // Aggregate measurements by direction axis
    const totals: Record<'x' | 'y', { pos: number; neg: number }> = {
      x: { pos: 0, neg: 0 },
      y: { pos: 0, neg: 0 },
    };

    for (const m of measurements) {
      if (!m.directionLabel) continue;
      const key = m.directionLabel.toLowerCase().trim();
      const mapping = DIRECTION_MAP[key];
      if (!mapping) continue;
      const bucket = totals[mapping.axis];
      if (mapping.sign === 1) bucket.pos = Math.max(bucket.pos, m.distance);
      else bucket.neg = Math.max(bucket.neg, m.distance);
    }

    const width = Math.round((totals.x.pos + totals.x.neg) * 10) / 10;
    const length = Math.round((totals.y.pos + totals.y.neg) * 10) / 10;

    if (width === 0 && length === 0) {
      return {
        error: 'Measurements found but none had recognized direction labels.',
        hint: 'Label measurements with: north/south/east/west or front/back/left/right.',
        measurements,
      };
    }

    const effectiveWidth = width || 10;
    const effectiveLength = length || 10;

    const walls: WallInput[] = [
      { order: 1, direction: 'right', length: effectiveWidth },
      { order: 2, direction: 'down', length: effectiveLength },
      { order: 3, direction: 'left', length: effectiveWidth },
      { order: 4, direction: 'up', length: effectiveLength },
    ];

    return this.create({
      name: body.roomName ?? 'Room from Capture',
      projectId: body.projectId ?? null,
      ceilingHeight: body.ceilingHeight ?? null,
      walls,
      draftCaptureSessionId: body.captureSessionId,
    });
  }

  async remove(id: number) {
    const room = await this.roomsRepo.findOne({
      where: { id },
      relations: ['walls'],
    });

    if (!room) {
      return { error: 'Room not found' };
    }

    await this.wallsRepo.delete({
      room: { id: room.id } as any,
    });

    await this.roomsRepo.delete(id);

    return { success: true };
  }
}