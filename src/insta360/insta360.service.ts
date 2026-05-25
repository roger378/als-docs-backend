import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Insta 360 cameras broadcast an OSC-compatible HTTP API when acting as Wi-Fi hotspot.
// Default camera IP in AP mode. X3/X4/X5 all use this address.
const CAMERA_IP = process.env.INSTA360_IP ?? '192.168.42.1';
const CAMERA_BASE_URL = `http://${CAMERA_IP}`;
const TIMEOUT_MS = 8000;

export type CameraInfo = {
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  supportedCommands: string[];
};

export type CameraFile = {
  name: string;
  fileUrl: string;
  size: number;
  dateTimeZone: string;
  width: number;
  height: number;
  thumbnail?: string;
};

@Injectable()
export class Insta360Service {
  private readonly logger = new Logger(Insta360Service.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  // ── Camera discovery & status ──────────────────────────────────────────────

  async getInfo(): Promise<CameraInfo> {
    const data = await this.get<any>('/osc/info');
    return {
      manufacturer: data.manufacturer ?? 'Insta360',
      model: data.model ?? 'Unknown',
      serialNumber: data.serialNumber ?? '',
      firmwareVersion: data.firmwareVersion ?? '',
      supportedCommands: data._commandsUrl ? [data._commandsUrl] : [],
    };
  }

  async getState(): Promise<any> {
    return this.post<any>('/osc/state', {});
  }

  async ping(): Promise<{ connected: boolean; ip: string; model?: string }> {
    try {
      const info = await this.getInfo();
      return { connected: true, ip: CAMERA_IP, model: info.model };
    } catch {
      return { connected: false, ip: CAMERA_IP };
    }
  }

  // ── Capture ────────────────────────────────────────────────────────────────

  async takePicture(): Promise<{ commandId: string; state: string }> {
    const result = await this.post<any>('/osc/commands/execute', {
      name: 'camera.takePicture',
    });
    return {
      commandId: result.id ?? '',
      state: result.state ?? 'done',
    };
  }

  async getCommandStatus(commandId: string): Promise<any> {
    return this.post<any>('/osc/commands/status', { id: commandId });
  }

  // ── File listing ───────────────────────────────────────────────────────────

  async listFiles(count = 10): Promise<CameraFile[]> {
    const result = await this.post<any>('/osc/commands/execute', {
      name: 'camera.listFiles',
      parameters: {
        fileType: 'image',
        entryCount: count,
        maxThumbSize: 640,
        _type: 'image',
      },
    });

    const entries: any[] = result.results?.entries ?? [];
    return entries.map((e) => ({
      name: e.name ?? '',
      fileUrl: e.fileUrl ?? e._thumbnail ?? '',
      size: e.size ?? 0,
      dateTimeZone: e.dateTimeZone ?? '',
      width: e.width ?? 0,
      height: e.height ?? 0,
      thumbnail: e._thumbnailUrl ?? e._thumbnail ?? null,
    }));
  }

  // ── Pull image to server ───────────────────────────────────────────────────

  /**
   * Downloads the most recent image from the camera and saves it to ./uploads/.
   * Returns the saved file URL and metadata.
   */
  async pullLatestImage(): Promise<{
    filename: string;
    url: string;
    originalName: string;
    size: number;
    mimeType: string;
  }> {
    const files = await this.listFiles(1);

    if (!files.length) {
      throw new Error('No images found on camera.');
    }

    return this.pullImageByUrl(files[0].fileUrl, files[0].name);
  }

  async pullImageByUrl(
    cameraFileUrl: string,
    originalName: string,
  ): Promise<{
    filename: string;
    url: string;
    originalName: string;
    size: number;
    mimeType: string;
  }> {
    // Camera file URLs are either absolute (http://...) or relative (/DCIM/...)
    const fullUrl = cameraFileUrl.startsWith('http')
      ? cameraFileUrl
      : `${CAMERA_BASE_URL}${cameraFileUrl}`;

    this.logger.log(`Downloading from camera: ${fullUrl}`);

    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const filename = `${Date.now()}-insta360${ext}`;
    const destPath = path.join(this.uploadsDir, filename);

    await this.downloadFile(fullUrl, destPath);

    const stats = fs.statSync(destPath);
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/jpeg';

    return {
      filename,
      url: `/uploads/${filename}`,
      originalName,
      size: stats.size,
      mimeType,
    };
  }

  // ── Camera settings ────────────────────────────────────────────────────────

  async getOptions(optionNames: string[] = []): Promise<any> {
    return this.post<any>('/osc/commands/execute', {
      name: 'camera.getOptions',
      parameters: { optionNames },
    });
  }

  async setOptions(options: Record<string, any>): Promise<any> {
    return this.post<any>('/osc/commands/execute', {
      name: 'camera.setOptions',
      parameters: { options },
    });
  }

  // ── HTTP helpers ───────────────────────────────────────────────────────────

  private get<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = `${CAMERA_BASE_URL}${path}`;
      const req = http.get(url, { timeout: TIMEOUT_MS }, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body) as T);
          } catch {
            reject(new Error(`Camera returned non-JSON: ${body.slice(0, 100)}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Camera request timed out (${TIMEOUT_MS}ms). Is the device connected to the Insta 360 Wi-Fi?`));
      });
    });
  }

  private post<T>(path: string, body: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const options = {
        hostname: CAMERA_IP,
        port: 80,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: TIMEOUT_MS,
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            reject(new Error(`Camera returned non-JSON: ${data.slice(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Camera request timed out. Is the device connected to the Insta 360 Wi-Fi?`));
      });

      req.write(payload);
      req.end();
    });
  }

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destPath);

      const req = protocol.get(url, { timeout: 60000 }, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          reject(new Error(`Camera returned HTTP ${res.statusCode} for file download`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      });

      req.on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(new Error('File download from camera timed out.'));
      });
    });
  }
}
