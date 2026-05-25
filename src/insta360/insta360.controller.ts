import { Body, Controller, Get, Post, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { Insta360Service } from './insta360.service';
import { PanoCapturesService } from '../pano-captures/pano-captures.service';
import { PanoAnalysisService } from '../pano-analysis/pano-analysis.service';

@Controller('insta360')
export class Insta360Controller {
  constructor(
    private readonly cameraService: Insta360Service,
    private readonly panoCapturesService: PanoCapturesService,
    private readonly analysisService: PanoAnalysisService,
  ) {}

  /** Check if camera is reachable on Wi-Fi */
  @Get('ping')
  ping() {
    return this.cameraService.ping();
  }

  /** Get camera model, firmware, serial */
  @Get('info')
  info() {
    return this.cameraService.getInfo();
  }

  /** Get battery, storage, current mode */
  @Get('state')
  state() {
    return this.cameraService.getState();
  }

  /** List recent images on camera's SD card */
  @Get('files')
  listFiles() {
    return this.cameraService.listFiles(20);
  }

  /** Trigger the camera shutter remotely */
  @Post('capture')
  takePicture() {
    return this.cameraService.takePicture();
  }

  /** Poll the status of a capture command */
  @Get('capture/status/:commandId')
  captureStatus(@Param('commandId') commandId: string) {
    return this.cameraService.getCommandStatus(commandId);
  }

  /**
   * Pull the most recent image from camera → save to ./uploads/ → create PanoCapture record.
   * Body (optional): { captureSessionId, roomId, sequenceNumber }
   */
  @Post('pull-latest')
  async pullLatest(
    @Body()
    body: {
      captureSessionId?: number;
      roomId?: number;
      sequenceNumber?: number;
    },
  ) {
    const saved = await this.cameraService.pullLatestImage();

    const pano = await this.panoCapturesService.create({
      fileUrl: saved.url,
      captureSessionId: body.captureSessionId ?? 0,
      roomId: body.roomId ?? undefined,
      sequenceNumber: body.sequenceNumber ?? 1,
    });

    return { ...saved, panoCapture: pano };
  }

  /**
   * Pull a specific file by its camera URL → save → create PanoCapture.
   * Body: { fileUrl, originalName, captureSessionId?, roomId?, sequenceNumber? }
   */
  @Post('pull-file')
  async pullFile(
    @Body()
    body: {
      fileUrl: string;
      originalName: string;
      captureSessionId?: number;
      roomId?: number;
      sequenceNumber?: number;
    },
  ) {
    const saved = await this.cameraService.pullImageByUrl(
      body.fileUrl,
      body.originalName,
    );

    const pano = await this.panoCapturesService.create({
      fileUrl: saved.url,
      captureSessionId: body.captureSessionId ?? 0,
      roomId: body.roomId ?? undefined,
      sequenceNumber: body.sequenceNumber ?? 1,
    });

    return { ...saved, panoCapture: pano };
  }

  /**
   * One-shot: take picture → pull it → analyze it → return draft room layout.
   * Body: { captureSessionId?, cameraHeightFeet? }
   */
  @Post('capture-and-analyze')
  async captureAndAnalyze(
    @Body()
    body: {
      captureSessionId?: number;
      cameraHeightFeet?: number;
    },
  ) {
    // 1. Take the picture
    const capture = await this.cameraService.takePicture();

    // 2. Brief wait for camera to finish writing the file
    await new Promise((r) => setTimeout(r, 2500));

    // 3. Pull the file to server
    const saved = await this.cameraService.pullLatestImage();

    // 4. Create PanoCapture record
    const pano = await this.panoCapturesService.create({
      fileUrl: saved.url,
      captureSessionId: body.captureSessionId ?? 0,
      sequenceNumber: 1,
    });

    // 5. Analyze with Claude Vision
    const analysis = await this.analysisService.analyzeFromUrl(
      saved.url,
      body.cameraHeightFeet,
    );

    return {
      captureCommandId: capture.commandId,
      savedFile: saved,
      panoCapture: pano,
      analysis,
    };
  }

  /**
   * Mobile proxy: forwards a request to the camera API.
   * Used when the frontend is on phone/tablet and can't bypass CORS.
   * Body: { path: string, method: 'GET'|'POST', body?: any }
   */
  @Post('proxy')
  async proxy(
    @Body() body: { path: string; method?: string; payload?: any },
  ) {
    if (!body.path?.startsWith('/')) {
      return { error: 'path must start with /' };
    }
    // Re-use internal helpers by delegating to raw calls
    // This intentionally only allows known safe paths
    const allowed = ['/osc/info', '/osc/state', '/osc/commands/execute', '/osc/commands/status'];
    const base = body.path.split('?')[0];
    if (!allowed.includes(base)) {
      return { error: `Proxy path not allowed: ${body.path}` };
    }
    if (body.method === 'GET' || !body.method) {
      return this.cameraService.getInfo(); // safe fallback
    }
    // For POST, delegate via the service's public commands
    const name = body.payload?.name;
    if (name === 'camera.takePicture') return this.cameraService.takePicture();
    if (name === 'camera.listFiles') return this.cameraService.listFiles(body.payload?.parameters?.entryCount ?? 10);
    if (name === 'camera.getOptions') return this.cameraService.getOptions(body.payload?.parameters?.optionNames);
    return { error: `Unknown command: ${name}` };
  }
}
