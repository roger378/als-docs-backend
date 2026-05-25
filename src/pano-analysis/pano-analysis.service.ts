import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs';
import * as path from 'path';

type CardinalDirection = 'right' | 'left' | 'up' | 'down';

type WallInput = {
  order: number;
  length: number;
  direction: CardinalDirection;
};

type FloorCorner = {
  label: string;
  x: number; // room-coordinate feet
  y: number;
};

type AnalyzedOpening = {
  type: string;
  offsetFromWallStart: number;
  width: number;
  height: number | null;
  sillHeight: number | null;
  wallIndex: number;
};

export type PanoAnalysisResult = {
  cameraHeightFeet: number;
  ceilingHeightFeet: number | null;
  corners: FloorCorner[];
  walls: WallInput[];
  openings: AnalyzedOpening[];
  roomType: string | null;
  area: number;
  notes: string;
  rawClaudeResponse: any;
};

// Used when only one pano is provided for the room
const CLAUDE_PROMPT = `You are analyzing a 360° equirectangular panoramic image of an interior room.
Your task: identify the room's floor plan geometry so I can generate a sketch.

PROJECTION RULES (equirectangular):
- Horizontal: x=0.0 (far left) to x=1.0 (far right) spans 360°. x=0.5 is directly in front.
- Vertical: y=0.0 is the ceiling zenith, y=0.5 is the horizon (eye level), y=1.0 is the nadir (floor below camera).
- Walls far away appear near y=0.5. Walls close by appear near y=1.0.

TASK:
1. Find every WALL-FLOOR CORNER — where two adjacent walls meet at the floor. Give the x/y fraction where that junction appears in the image.
2. Find every OPENING (doors, windows, cased openings). For each: left/right floor x-fractions, top y-fraction, and bottom y-fraction (y=1.0 for a door that reaches the floor).
3. Estimate the camera height above the floor in feet.
4. Identify the room type.

List corners CLOCKWISE starting from the corner that appears leftmost in the image.

Return ONLY a JSON object matching this schema exactly:
{
  "cameraHeightFeet": <number>,
  "corners": [
    { "label": "c1", "xFraction": <0.0–1.0>, "yFraction": <0.5–1.0> }
  ],
  "openings": [
    {
      "type": "door" | "window" | "cased_opening" | "garage_door",
      "leftXFraction": <number>,
      "rightXFraction": <number>,
      "topYFraction": <number>,
      "bottomYFraction": <number>,
      "widthEstimateFeet": <number or null>,
      "heightEstimateFeet": <number or null>
    }
  ],
  "roomType": "bedroom" | "bathroom" | "kitchen" | "living_room" | "dining_room" | "hallway" | "garage" | "other",
  "ceilingHeightFeet": <number — estimate the floor-to-ceiling height; typical rooms are 8–10 ft>,
  "notes": "<string>"
}`;

// Used when 2+ panos are provided — Claude reconciles all positions into one floor plan
const CLAUDE_MULTI_PROMPT = (count: number) =>
  `You are analyzing ${count} 360° equirectangular panoramic images of THE SAME interior room, each taken from a DIFFERENT position within the room.

KEY ACCURACY RULE:
- Walls that appear LOW in an image (yFraction close to 1.0) are CLOSE to that camera — measure them from that image.
- Walls that appear HIGH (yFraction near 0.5) are FAR from that camera — less accurate, use a closer image if available.
- Cross-check: the same corner should produce a consistent floor position across images that can both see it.

PROJECTION RULES (equirectangular, applies to every image):
- Horizontal x=0.0–1.0 spans 360°. x=0.5 is directly in front of that camera.
- Vertical y=0.0 is ceiling, y=0.5 is horizon, y=1.0 is directly below camera.

YOUR TASK — produce ONE reconciled floor plan:
1. For each wall-floor corner, pick the image where it appears CLOSEST (highest yFraction) and use those coordinates.
2. Average measurements across images when a wall is equally visible in multiple.
3. Find every OPENING (doors, windows) from the image where it is most clearly visible.

Label each corner by which image you used: e.g. "c1_img2" = corner 1, best seen in image 2.

Return ONLY a JSON object matching this schema:
{
  "cameraHeightFeet": <number, average across images>,
  "corners": [
    { "label": "c1_img1", "xFraction": <0.0–1.0>, "yFraction": <0.5–1.0>, "sourceImage": <1-based index> }
  ],
  "openings": [
    {
      "type": "door" | "window" | "cased_opening" | "garage_door",
      "leftXFraction": <number>,
      "rightXFraction": <number>,
      "topYFraction": <number>,
      "bottomYFraction": <number>,
      "widthEstimateFeet": <number or null>,
      "heightEstimateFeet": <number or null>,
      "sourceImage": <1-based index>
    }
  ],
  "roomType": "bedroom" | "bathroom" | "kitchen" | "living_room" | "dining_room" | "hallway" | "garage" | "other",
  "ceilingHeightFeet": <number — estimate the floor-to-ceiling height; typical rooms are 8–10 ft>,
  "notes": "<string describing which images contributed most and any reconciliation decisions>"
}`;

@Injectable()
export class PanoAnalysisService {
  private readonly logger = new Logger(PanoAnalysisService.name);
  private readonly anthropic: Anthropic;
  private readonly uploadsDir: string;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    this.uploadsDir = path.join(process.cwd(), 'uploads');
  }

  async analyzeFromUrl(
    fileUrl: string,
    cameraHeightOverrideFt?: number,
  ): Promise<PanoAnalysisResult> {
    const filename = path.basename(fileUrl);
    const filePath = path.join(this.uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Image file not found: ${filePath}`);
    }

    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = this.detectMimeType(filename);

    this.logger.log(`Analyzing pano: ${filename} (${Math.round(imageBuffer.length / 1024)} KB)`);

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: base64Image },
            },
            { type: 'text', text: CLAUDE_PROMPT },
          ],
        },
      ],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    let claudeData: any;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      claudeData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      throw new Error(`Claude returned non-JSON response: ${rawText.slice(0, 200)}`);
    }

    return this.buildResult(claudeData, cameraHeightOverrideFt);
  }

  /**
   * Analyze 2–4 panos of the same room taken from different positions.
   * Sends all images to Claude in one message with the reconciliation prompt.
   * Falls back to single-image analysis if only one URL is provided.
   */
  async analyzeMultipleFromUrls(
    fileUrls: string[],
    cameraHeightOverrideFt?: number,
  ): Promise<PanoAnalysisResult> {
    if (fileUrls.length === 1) {
      return this.analyzeFromUrl(fileUrls[0], cameraHeightOverrideFt);
    }

    const imageBlocks: Anthropic.ImageBlockParam[] = fileUrls.map((fileUrl) => {
      const filename = path.basename(fileUrl);
      const filePath = path.join(this.uploadsDir, filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Image file not found: ${filePath}`);
      }
      const base64 = fs.readFileSync(filePath).toString('base64');
      const mimeType = this.detectMimeType(filename);
      return { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };
    });

    this.logger.log(`Multi-pano analysis: ${fileUrls.length} images`);

    // Interleave each image with its sequence label so Claude can reference them
    const contentBlocks: Anthropic.ContentBlockParam[] = [];
    imageBlocks.forEach((img, i) => {
      contentBlocks.push({ type: 'text', text: `Image ${i + 1} of ${fileUrls.length}:` });
      contentBlocks.push(img);
    });
    contentBlocks.push({ type: 'text', text: CLAUDE_MULTI_PROMPT(fileUrls.length) });

    const response = await this.anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 3000,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    let claudeData: any;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      claudeData = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      throw new Error(`Claude returned non-JSON: ${rawText.slice(0, 200)}`);
    }

    return this.buildResult(claudeData, cameraHeightOverrideFt);
  }

  buildResult(claudeData: any, cameraHeightOverrideFt?: number): PanoAnalysisResult {
    const cameraHeight = cameraHeightOverrideFt ?? claudeData.cameraHeightFeet ?? 4.5;
    const ceilingHeightFeet: number | null =
      claudeData.ceilingHeightFeet != null && Number.isFinite(Number(claudeData.ceilingHeightFeet))
        ? Math.round(Number(claudeData.ceilingHeightFeet) * 10) / 10
        : null;

    const rawCorners: Array<{ label: string; xFraction: number; yFraction: number }> =
      claudeData.corners ?? [];

    const floorCorners: FloorCorner[] = rawCorners
      .map((c) => {
        const pos = this.fractionToFloorPosition(c.xFraction, c.yFraction, cameraHeight);
        if (!pos) return null;
        return { label: c.label, x: pos.x, y: pos.y };
      })
      .filter((c): c is FloorCorner => c !== null);

    const walls = this.cornersToWalls(floorCorners);
    const area = this.polygonArea(floorCorners);

    const rawOpenings: any[] = claudeData.openings ?? [];
    const openings = this.parseOpenings(rawOpenings, floorCorners, walls, cameraHeight);

    return {
      cameraHeightFeet: cameraHeight,
      ceilingHeightFeet,
      corners: floorCorners,
      walls,
      openings,
      roomType: claudeData.roomType ?? null,
      area,
      notes: claudeData.notes ?? '',
      rawClaudeResponse: claudeData,
    };
  }

  // ── Geometry helpers ─────────────────────────────────────────────────────────

  private fractionToFloorPosition(
    xFrac: number,
    yFrac: number,
    cameraHeightFt: number,
  ): { x: number; y: number } | null {
    // Equirectangular → spherical angles
    const theta = xFrac * 2 * Math.PI - Math.PI; // horizontal: -π to π
    const phi = Math.PI / 2 - yFrac * Math.PI;   // vertical: π/2 (zenith) to -π/2 (nadir)

    // phi must be negative (below horizon) to hit the floor
    if (phi >= -0.01) return null;

    const distance = cameraHeightFt / Math.tan(-phi);
    return {
      x: Math.round(distance * Math.sin(theta) * 100) / 100,
      y: Math.round(distance * Math.cos(theta) * 100) / 100,
    };
  }

  private cornersToWalls(corners: FloorCorner[]): WallInput[] {
    if (corners.length < 2) return [];

    return corners.map((corner, i) => {
      const next = corners[(i + 1) % corners.length];
      const dx = next.x - corner.x;
      const dy = next.y - corner.y;
      const length = Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10;
      const direction = this.snapToCardinal(dx, dy);
      return { order: i + 1, length, direction };
    });
  }

  private snapToCardinal(dx: number, dy: number): CardinalDirection {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? 'right' : 'left';
    }
    return dy >= 0 ? 'up' : 'down';
  }

  private polygonArea(corners: FloorCorner[]): number {
    if (corners.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.round(Math.abs(area) / 2 * 10) / 10;
  }

  private parseOpenings(
    rawOpenings: any[],
    corners: FloorCorner[],
    walls: WallInput[],
    cameraHeight: number,
  ): AnalyzedOpening[] {
    return rawOpenings
      .map((o) => {
        const leftPos = this.fractionToFloorPosition(o.leftXFraction, o.bottomYFraction ?? 1.0, cameraHeight);
        const rightPos = this.fractionToFloorPosition(o.rightXFraction, o.bottomYFraction ?? 1.0, cameraHeight);

        if (!leftPos || !rightPos) return null;

        const width =
          o.widthEstimateFeet ??
          Math.round(Math.sqrt(
            (rightPos.x - leftPos.x) ** 2 + (rightPos.y - leftPos.y) ** 2,
          ) * 10) / 10;

        const heightFt =
          o.heightEstimateFeet ??
          (o.topYFraction != null
            ? this.angleHeightToFeet(o.topYFraction, o.bottomYFraction ?? 1.0, cameraHeight)
            : null);

        const wallIndex = this.findNearestWallIndex(leftPos, rightPos, corners);

        const offsetFromWallStart =
          wallIndex >= 0
            ? Math.round(
                Math.sqrt(
                  (leftPos.x - corners[wallIndex].x) ** 2 +
                  (leftPos.y - corners[wallIndex].y) ** 2,
                ) * 10,
              ) / 10
            : 0;

        return {
          type: o.type ?? 'door',
          offsetFromWallStart,
          width,
          height: heightFt,
          sillHeight: o.type === 'window' ? Math.round(cameraHeight * 0.5 * 10) / 10 : null,
          wallIndex,
        };
      })
      .filter((o): o is AnalyzedOpening => o !== null);
  }

  private angleHeightToFeet(topYFrac: number, bottomYFrac: number, cameraHeight: number): number {
    const phiTop = Math.PI / 2 - topYFrac * Math.PI;
    const phiBottom = Math.PI / 2 - bottomYFrac * Math.PI;
    const distTop = phiTop < 0 ? cameraHeight / Math.tan(-phiTop) : cameraHeight * 2;
    const distBottom = phiBottom < 0 ? cameraHeight / Math.tan(-phiBottom) : 0;
    const heightAboveFloor = cameraHeight - distTop * Math.tan(-phiTop);
    return Math.max(0, Math.round(heightAboveFloor * 10) / 10);
  }

  private findNearestWallIndex(
    leftPos: { x: number; y: number },
    rightPos: { x: number; y: number },
    corners: FloorCorner[],
  ): number {
    if (corners.length < 2) return -1;

    let bestWall = 0;
    let bestDist = Infinity;

    const midX = (leftPos.x + rightPos.x) / 2;
    const midY = (leftPos.y + rightPos.y) / 2;

    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      const dist = this.pointToSegmentDist(midX, midY, a.x, a.y, b.x, b.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestWall = i;
      }
    }

    return bestWall;
  }

  private pointToSegmentDist(
    px: number, py: number,
    ax: number, ay: number,
    bx: number, by: number,
  ): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
  }

  private detectMimeType(filename: string): 'image/jpeg' | 'image/png' | 'image/webp' {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg'; // .jpg, .jpeg, .insp (Insta 360 raw)
  }
}
