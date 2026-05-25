import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../rooms/room.entity';
import { Wall } from '../walls/walls.entity';
import { Project } from '../projects/project.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,

    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,

    @InjectRepository(Wall)
    private readonly wallsRepo: Repository<Wall>,
  ) {}

  async buildXactimateXml(projectId: number): Promise<string> {
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const rooms = await this.roomsRepo.find({
      where: { project: { id: projectId } },
      relations: ['walls'],
      order: { id: 'ASC' },
    });

    const wallIds = rooms.flatMap((r) => (r.walls ?? []).map((w: any) => w.id));
    const openingsByWallId: Record<number, any[]> = {};
    if (wallIds.length) {
      const openings = await this.wallsRepo.manager
        .createQueryBuilder()
        .select(['o.id', 'o.type', 'o.offsetFromWallStart', 'o.width', 'o.height', 'o.sillHeight', 'o.wallId'])
        .from('opening', 'o')
        .where('o.wallId IN (:...wallIds)', { wallIds })
        .getRawMany();
      for (const o of openings) {
        const wid = Number(o.wallId);
        if (!openingsByWallId[wid]) openingsByWallId[wid] = [];
        openingsByWallId[wid].push(o);
      }
    }

    const date = new Date().toISOString().slice(0, 10);

    const roomXml = rooms.map((room, idx) => {
      const walls = [...(room.walls ?? [])].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      const perimeter = walls.reduce((s: number, w: any) => s + Number(w.length ?? 0), 0);

      const wallsXml = walls.map((w: any) => {
        const openings = (openingsByWallId[w.id] ?? []).map((o: any) => {
          const type = o.o_type ?? o.type ?? 'door';
          const width = Number(o.o_width ?? o.width ?? 0).toFixed(2);
          const height = Number(o.o_height ?? o.height ?? (type === 'window' ? 4 : 6.8)).toFixed(2);
          const offset = Number(o.o_offsetFromWallStart ?? o.offsetFromWallStart ?? 0).toFixed(2);
          return `        <Opening type="${esc(type)}" offset="${offset}" width="${width}" height="${height}"/>`;
        }).join('\n');
        return `      <Wall order="${w.order ?? idx + 1}" direction="${w.direction ?? ''}" length="${Number(w.length ?? 0).toFixed(2)}">${openings ? '\n' + openings + '\n      ' : ''}</Wall>`;
      }).join('\n');

      return `    <Room id="${room.id}" index="${idx + 1}">
      <Name>${esc(room.name)}</Name>
      <Area unit="sqft">${Number(room.area ?? 0).toFixed(2)}</Area>
      <Perimeter unit="ft">${perimeter.toFixed(2)}</Perimeter>
      <CeilingHeight unit="ft">${room.ceilingHeight != null ? Number(room.ceilingHeight).toFixed(2) : ''}</CeilingHeight>
      <Walls>
${wallsXml}
      </Walls>
    </Room>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<!-- ScopetoPay Xactimate Reference Export — ${date} -->
<!-- Import this file into your Xactimate estimate as a room reference -->
<Estimate xmlns:als="https://scopetopay.com/export/v1">
  <Project>
    <Name>${esc((project as any).name ?? '')}</Name>
    <Address>${esc((project as any).address ?? '')}</Address>
    <ExportDate>${date}</ExportDate>
  </Project>
  <Rooms>
${roomXml}
  </Rooms>
</Estimate>
`;
  }

  async buildProjectReport(projectId: number): Promise<string> {
    const project = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const rooms = await this.roomsRepo.find({
      where: { project: { id: projectId } },
      relations: ['walls'],
      order: { id: 'ASC' },
    });

    // Fetch openings for all walls
    const wallIds = rooms.flatMap((r) => (r.walls ?? []).map((w: any) => w.id));
    const openingsByWallId: Record<number, any[]> = {};

    if (wallIds.length) {
      const openings = await this.wallsRepo.manager
        .createQueryBuilder()
        .select(['o.id', 'o.type', 'o.offsetFromWallStart', 'o.width', 'o.height', 'o.wallId'])
        .from('opening', 'o')
        .where('o.wallId IN (:...wallIds)', { wallIds })
        .orderBy('o.wallId', 'ASC')
        .getRawMany();

      for (const o of openings) {
        const wid = Number(o.wallId);
        if (!openingsByWallId[wid]) openingsByWallId[wid] = [];
        openingsByWallId[wid].push(o);
      }
    }

    const totalArea = rooms.reduce((s, r) => s + Number(r.area ?? 0), 0);
    const totalPerimeter = rooms.reduce(
      (s, r) => s + (r.walls ?? []).reduce((ws: number, w: any) => ws + Number(w.length ?? 0), 0),
      0,
    );

    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const roomCards = rooms.map((room, idx) => {
      const walls = [...(room.walls ?? [])].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      const perimeter = walls.reduce((s: number, w: any) => s + Number(w.length ?? 0), 0);
      const roomType = (room as any).draftRoomType
        ? String((room as any).draftRoomType).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        : '';

      const wallRows = walls.map((w: any) => {
        const openings = openingsByWallId[w.id] ?? [];
        const openingText = openings.length
          ? openings.map((o: any) => `${o.o_type ?? o.type} ${Number(o.o_width ?? o.width ?? 0).toFixed(1)}′`).join(', ')
          : '—';
        return `
          <tr>
            <td>Wall ${w.order ?? '?'}</td>
            <td>${Number(w.length ?? 0).toFixed(1)} ft</td>
            <td>${w.direction ?? '—'}</td>
            <td>${openingText}</td>
          </tr>`;
      }).join('');

      const svgBlock = room.svg
        ? `<div class="svg-wrap">${scaleSvg(room.svg)}</div>`
        : `<div class="svg-placeholder">No sketch</div>`;

      return `
        <div class="room-card">
          <div class="room-header">
            <span class="room-index">${idx + 1}</span>
            <div>
              <div class="room-name">${esc(room.name)}</div>
              ${roomType ? `<div class="room-type">${esc(roomType)}</div>` : ''}
            </div>
          </div>

          <div class="room-body">
            ${svgBlock}
            <div class="room-stats">
              <div class="stat"><span class="stat-value">${Number(room.area ?? 0).toFixed(1)}</span><span class="stat-label">ft² area</span></div>
              <div class="stat"><span class="stat-value">${room.ceilingHeight != null ? Number(room.ceilingHeight).toFixed(1) : '—'}</span><span class="stat-label">ft ceiling</span></div>
              <div class="stat"><span class="stat-value">${perimeter.toFixed(1)}</span><span class="stat-label">ft perimeter</span></div>
              <div class="stat"><span class="stat-value">${walls.length}</span><span class="stat-label">walls</span></div>
            </div>
          </div>

          ${walls.length ? `
          <table class="wall-table">
            <thead><tr><th>Wall</th><th>Length</th><th>Direction</th><th>Openings</th></tr></thead>
            <tbody>${wallRows}</tbody>
          </table>` : ''}
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project.name)} — Floor Plan Report</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; background: #fff; padding: 32px; }
  h1 { font-size: 22px; font-weight: 700; }
  h2 { font-size: 14px; font-weight: 600; color: #555; margin-bottom: 4px; }
  .header { border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 20px; }
  .header-meta { color: #555; font-size: 12px; margin-top: 4px; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #ddd; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; margin-bottom: 28px; }
  .summary-cell { background: #f9f9f9; padding: 12px; text-align: center; }
  .summary-cell .big { font-size: 22px; font-weight: 700; }
  .summary-cell .lbl { font-size: 11px; color: #777; margin-top: 2px; }
  .rooms-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .room-card { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; break-inside: avoid; }
  .room-header { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; background: #f4f4f4; border-bottom: 1px solid #ddd; }
  .room-index { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #111; color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .room-name { font-weight: 600; font-size: 14px; }
  .room-type { font-size: 11px; color: #777; margin-top: 1px; text-transform: capitalize; }
  .room-body { display: flex; gap: 12px; padding: 12px 14px; }
  .svg-wrap { flex-shrink: 0; width: 120px; }
  .svg-wrap svg { width: 100%; height: auto; }
  .svg-placeholder { width: 120px; height: 90px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #aaa; }
  .room-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; flex: 1; align-content: start; }
  .stat { background: #f9f9f9; border-radius: 4px; padding: 6px 8px; }
  .stat-value { display: block; font-weight: 700; font-size: 15px; }
  .stat-label { display: block; font-size: 10px; color: #777; margin-top: 1px; }
  .wall-table { width: 100%; border-collapse: collapse; font-size: 11px; border-top: 1px solid #eee; }
  .wall-table th, .wall-table td { padding: 5px 10px; text-align: left; border-bottom: 1px solid #f0f0f0; }
  .wall-table th { background: #fafafa; font-weight: 600; color: #555; }
  .footer { margin-top: 32px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 11px; color: #aaa; text-align: center; }
  @media print {
    body { padding: 16px; }
    @page { margin: 1.5cm; }
    .rooms-grid { grid-template-columns: repeat(2, 1fr); }
    .room-card { break-inside: avoid; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<div class="header">
  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
    <div>
      <h1>${esc(project.name)}</h1>
      ${project.address ? `<div class="header-meta">${esc(project.address)}</div>` : ''}
      <div class="header-meta">Generated ${generatedDate}</div>
    </div>
    <button class="no-print" onclick="window.print()" style="padding:8px 18px;background:#111;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px">
      Print / Save PDF
    </button>
  </div>
</div>

<div class="summary">
  <div class="summary-cell"><div class="big">${rooms.length}</div><div class="lbl">Room${rooms.length !== 1 ? 's' : ''}</div></div>
  <div class="summary-cell"><div class="big">${totalArea.toFixed(0)}</div><div class="lbl">Total ft²</div></div>
  <div class="summary-cell"><div class="big">${totalPerimeter.toFixed(0)}</div><div class="lbl">Total Perimeter ft</div></div>
</div>

<div class="rooms-grid">
${roomCards}
</div>

<div class="footer">ScopetoPay · ${esc(project.name)} · ${generatedDate}</div>

</body>
</html>`;
  }
}

function esc(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scaleSvg(svg: string): string {
  return svg
    .replace(/width="[^"]*"/, 'width="100%"')
    .replace(/height="[^"]*"/, 'height="auto"');
}
