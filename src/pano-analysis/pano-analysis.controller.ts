import { Body, Controller, Post } from '@nestjs/common';
import { PanoAnalysisService, PanoAnalysisResult } from './pano-analysis.service';
import { PanoCapturesService } from '../pano-captures/pano-captures.service';
import { RoomsService } from '../rooms/rooms.service';
import { OpeningsService } from '../openings/openings.service';

@Controller('pano-analysis')
export class PanoAnalysisController {
  constructor(
    private readonly analysisService: PanoAnalysisService,
    private readonly panoCapturesService: PanoCapturesService,
    private readonly roomsService: RoomsService,
    private readonly openingsService: OpeningsService,
  ) {}

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async saveOpenings(room: any, analysis: PanoAnalysisResult): Promise<void> {
    if (!analysis.openings?.length || !room?.walls?.length) return;

    const walls: Array<{ id: number; order: number }> = (room.walls as any[])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (const opening of analysis.openings) {
      const wallIndex = opening.wallIndex ?? 0;
      const wall = walls[wallIndex] ?? walls[0];
      if (!wall) continue;

      await this.openingsService.create({
        wallId: wall.id,
        type: opening.type ?? 'door',
        offsetFromWallStart: opening.offsetFromWallStart ?? 0,
        width: opening.width ?? 0,
        height: opening.height ?? null,
        sillHeight: opening.sillHeight ?? null,
        isExterior: opening.type === 'window' || opening.type === 'garage_door',
      });
    }
  }

  private async createRoomFromAnalysis(opts: {
    name: string;
    projectId?: number | null;
    ceilingHeight?: number | null;
    captureSessionId?: number | null;
    analysis: PanoAnalysisResult;
  }) {
    const room = await this.roomsService.create({
      name: opts.name,
      projectId: opts.projectId ?? null,
      // Prefer explicitly provided ceiling height, then fall back to AI estimate
      ceilingHeight: opts.ceilingHeight ?? opts.analysis.ceilingHeightFeet ?? null,
      walls: opts.analysis.walls,
      draftCaptureSessionId: opts.captureSessionId ?? null,
      draftBasisMediaId: null,
      draftRoomType: opts.analysis.roomType,
      draftSuggestedWidth: null,
      draftSuggestedLength: null,
      draftSuggestedWallCount: opts.analysis.walls.length,
      draftConfidenceNote: opts.analysis.notes,
    });

    await this.saveOpenings(room, opts.analysis);

    // Reload so the response includes the saved openings via walls
    return this.roomsService.findOneWithWalls(room!.id);
  }

  // ── Endpoints ─────────────────────────────────────────────────────────────────

  /**
   * Analyze a pano and return draft geometry — nothing saved.
   * Body: { panoCaptureId, cameraHeightFeet? }
   */
  @Post('analyze')
  async analyze(@Body() body: { panoCaptureId: number; cameraHeightFeet?: number }) {
    const pano = await this.panoCapturesService.findOne(body.panoCaptureId);
    if (!pano) return { error: 'PanoCapture not found' };
    return this.analysisService.analyzeFromUrl(pano.fileUrl, body.cameraHeightFeet);
  }

  /**
   * Analyze a pano and create a draft Room with walls + openings.
   * Body: { panoCaptureId, projectId?, roomName?, cameraHeightFeet?, ceilingHeight? }
   */
  @Post('analyze-and-create-room')
  async analyzeAndCreateRoom(
    @Body()
    body: {
      panoCaptureId: number;
      projectId?: number;
      roomName?: string;
      cameraHeightFeet?: number;
      ceilingHeight?: number;
    },
  ) {
    const pano = await this.panoCapturesService.findOne(body.panoCaptureId);
    if (!pano) return { error: 'PanoCapture not found' };

    const analysis = await this.analysisService.analyzeFromUrl(pano.fileUrl, body.cameraHeightFeet);

    const room = await this.createRoomFromAnalysis({
      name: body.roomName ?? analysis.roomType ?? 'New Room',
      projectId: body.projectId ?? null,
      ceilingHeight: body.ceilingHeight ?? null,
      captureSessionId: pano.captureSessionId,
      analysis,
    });

    return { analysis, room };
  }

  /**
   * Analyze using a direct file URL (no PanoCapture record required).
   * Body: { fileUrl, cameraHeightFeet? }
   */
  @Post('analyze-url')
  analyzeUrl(@Body() body: { fileUrl: string; cameraHeightFeet?: number }) {
    return this.analysisService.analyzeFromUrl(body.fileUrl, body.cameraHeightFeet);
  }

  /**
   * Batch-analyze a full capture session — one room per group of pano captures.
   * Body: {
   *   projectId?,
   *   cameraHeightFeet?,
   *   rooms: Array<{ name, panoCaptureIds, ceilingHeight? }>
   * }
   */
  @Post('analyze-session')
  async analyzeSession(
    @Body()
    body: {
      projectId?: number;
      cameraHeightFeet?: number;
      rooms: Array<{ name: string; panoCaptureIds: number[]; ceilingHeight?: number }>;
    },
  ) {
    if (!body.rooms?.length) return { error: 'No rooms provided.' };

    const results: Array<{
      roomName: string;
      status: 'ok' | 'error';
      room?: any;
      analysis?: any;
      error?: string;
    }> = [];

    for (const roomGroup of body.rooms) {
      if (!roomGroup.panoCaptureIds?.length) {
        results.push({ roomName: roomGroup.name, status: 'error', error: 'No pano captures for this room.' });
        continue;
      }

      try {
        const allPanos = await Promise.all(
          roomGroup.panoCaptureIds.map((id) => this.panoCapturesService.findOne(id)),
        );
        const fileUrls = allPanos
          .filter((p): p is NonNullable<typeof p> => p !== null)
          .map((p) => p.fileUrl);

        const primaryPano = allPanos.find((p) => p !== null);

        const analysis = await this.analysisService.analyzeMultipleFromUrls(
          fileUrls,
          body.cameraHeightFeet,
        );

        const room = await this.createRoomFromAnalysis({
          name: roomGroup.name || analysis.roomType || 'Room',
          projectId: body.projectId ?? null,
          ceilingHeight: roomGroup.ceilingHeight ?? null,
          captureSessionId: primaryPano?.captureSessionId ?? null,
          analysis,
        });

        results.push({ roomName: roomGroup.name, status: 'ok', room, analysis });
      } catch (err: any) {
        results.push({ roomName: roomGroup.name, status: 'error', error: err?.message ?? 'Analysis failed.' });
      }
    }

    return {
      total: results.length,
      succeeded: results.filter((r) => r.status === 'ok').length,
      failed: results.filter((r) => r.status === 'error').length,
      rooms: results,
    };
  }
}
