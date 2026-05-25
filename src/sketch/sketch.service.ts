import { Injectable } from '@nestjs/common';

type WallInput = {
  order: number;
  length: number;
  direction: 'right' | 'left' | 'up' | 'down';
};

type Point = {
  x: number;
  y: number;
};

@Injectable()
export class SketchService {
  generateSketch(walls: WallInput[]) {
    let x = 0;
    let y = 0;

    const points: Point[] = [{ x: 0, y: 0 }];

    for (const wall of walls) {
      switch (wall.direction) {
        case 'right':
          x += Number(wall.length);
          break;
        case 'left':
          x -= Number(wall.length);
          break;
        case 'up':
          y += Number(wall.length);
          break;
        case 'down':
          y -= Number(wall.length);
          break;
      }

      points.push({ x, y });
    }

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padding = 40;
    const scale = 20;

    const width = (maxX - minX) * scale + padding * 2;
    const height = (maxY - minY) * scale + padding * 2;

    const svgPointObjects = points.map((p) => {
      const svgX = (p.x - minX) * scale + padding;
      const svgY = height - ((p.y - minY) * scale + padding);

      return {
        original: p,
        svgX,
        svgY,
      };
    });

    const svgPoints = svgPointObjects
      .map((p) => `${p.svgX},${p.svgY}`)
      .join(' ');

    const lineLabels = walls
      .map((wall, index) => {
        const start = svgPointObjects[index];
        const end = svgPointObjects[index + 1];

        const midX = (start.svgX + end.svgX) / 2;
        const midY = (start.svgY + end.svgY) / 2;

        return `
          <text
            x="${midX}"
            y="${midY - 8}"
            font-size="14"
            text-anchor="middle"
            fill="red"
            font-family="Arial, sans-serif"
          >
            ${wall.length}
          </text>
        `;
      })
      .join('');

    const uniqueCornerPoints = svgPointObjects.slice(0, -1);

    const cornerMarkers = uniqueCornerPoints
      .map(
        (point, index) => `
          <circle
            cx="${point.svgX}"
            cy="${point.svgY}"
            r="5"
            fill="#2563eb"
            stroke="white"
            stroke-width="2"
          />
          <text
            x="${point.svgX + 10}"
            y="${point.svgY - 10}"
            font-size="12"
            fill="#2563eb"
            font-family="Arial, sans-serif"
          >
            P${index + 1}
          </text>
        `,
      )
      .join('');

    const svg = `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
      >
        <rect x="0" y="0" width="${width}" height="${height}" fill="white" />
        <polyline
          points="${svgPoints}"
          fill="none"
          stroke="black"
          stroke-width="3"
        />
        ${lineLabels}
        ${cornerMarkers}
      </svg>
    `;

    const area = this.calculateArea(points);

    return {
      walls,
      points,
      area,
      svg,
    };
  }

  private calculateArea(points: Point[]) {
    if (points.length < 3) return 0;

    let area = 0;

    for (let i = 0; i < points.length - 1; i++) {
      area += points[i].x * points[i + 1].y;
      area -= points[i + 1].x * points[i].y;
    }

    return Math.abs(area / 2);
  }
}