import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GroundObserver, SatelliteState, WalkerConfig } from '../types';
import { RUSSIAN_REGIONS, getStudentGridNodes, geodeticToEcef, WGS84 } from '../lib/orbitPhysics';
import { MapPin, RefreshCw, Eye, Globe } from 'lucide-react';

interface WorldCoverageMapProps {
  config: WalkerConfig;
  sats: SatelliteState[];
  selectedObserver: GroundObserver;
  onSelectObserver: (obs: GroundObserver) => void;
  onCustomCoordSelect: (lat: number, lon: number) => void;
}

export const WorldCoverageMap: React.FC<WorldCoverageMapProps> = ({
  config,
  sats,
  selectedObserver,
  onSelectObserver,
  onCustomCoordSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isComputingMap, setIsComputingMap] = useState(false);
  const [coverageData, setCoverageData] = useState<number[][] | null>(null);
  const [displayMode, setDisplayMode] = useState<'satsCount' | 'pointsOnly'>('satsCount');

  const studentNodes = useMemo(() => getStudentGridNodes(), []);

  // Compute coverage grid (like plot_global_coverage.m)
  const computeCoverageGrid = () => {
    setIsComputingMap(true);
    setTimeout(() => {
      // 5-degree step for fast interactive web rendering
      const latStep = 5;
      const lonStep = 6;
      const lats: number[] = [];
      for (let lat = -90; lat <= 90; lat += latStep) lats.push(lat);
      const lons: number[] = [];
      for (let lon = -180; lon <= 180; lon += lonStep) lons.push(lon);

      const minElevRad = (config.maskAngleDeg * Math.PI) / 180;
      const grid: number[][] = [];

      for (let i = 0; i < lats.length; i++) {
        const row: number[] = [];
        const lat = lats[i];
        for (let j = 0; j < lons.length; j++) {
          const lon = lons[j];
          const [ux, uy, uz] = geodeticToEcef(lat, lon, 0);
          const uNorm = Math.sqrt(ux * ux + uy * uy + uz * uz);

          let visibleCount = 0;
          for (let k = 0; k < sats.length; k++) {
            const sat = sats[k];
            const dx = sat.x - ux;
            const dy = sat.y - uy;
            const dz = sat.z - uz;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const dotProd = ux * dx + uy * dy + uz * dz;
            const sinElev = dotProd / (uNorm * dist);
            const elevRad = Math.asin(Math.max(-1, Math.min(1, sinElev)));

            if (elevRad >= minElevRad) {
              visibleCount++;
            }
          }
          row.push(visibleCount);
        }
        grid.push(row);
      }

      setCoverageData(grid);
      setIsComputingMap(false);
    }, 50);
  };

  // Recompute when sats or config change
  useEffect(() => {
    computeCoverageGrid();
  }, [config.N, config.P, config.S, config.F, config.h, config.incDeg, config.maskAngleDeg]);

  // Render to 2D Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background (ocean)
    ctx.fillStyle = '#0a101f';
    ctx.fillRect(0, 0, width, height);

    // Coordinate conversion
    const lonToX = (lon: number) => ((lon + 180) / 360) * width;
    const latToY = (lat: number) => ((90 - lat) / 180) * height;
    const xToLon = (x: number) => (x / width) * 360 - 180;
    const yToLat = (y: number) => 90 - (y / height) * 180;

    // Draw Coverage Heatmap if available
    if (coverageData && displayMode === 'satsCount') {
      const numRows = coverageData.length;
      const numCols = coverageData[0].length;
      const cellW = width / (numCols - 1);
      const cellH = height / (numRows - 1);

      for (let i = 0; i < numRows - 1; i++) {
        for (let j = 0; j < numCols - 1; j++) {
          const val = coverageData[i][j];
          // Turbo-like colormap from 0 to 18 visible satellites
          ctx.fillStyle = getTurboColor(val, 0, 18);
          ctx.fillRect(j * cellW, i * cellH, cellW + 1, cellH + 1);
        }
      }
    }

    // Draw Land Outlines (Approximate coastlines)
    drawSimplifiedWorldMap(ctx, width, height);

    // Highlight Russian Federation Border Zone
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lonToX(25), latToY(80), lonToX(180) - lonToX(25), latToY(42) - latToY(80));

    // Lat/Lon Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.8;
    for (let lon = -180; lon <= 180; lon += 30) {
      ctx.beginPath();
      ctx.moveTo(lonToX(lon), 0);
      ctx.lineTo(lonToX(lon), height);
      ctx.stroke();
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      ctx.beginPath();
      ctx.moveTo(0, latToY(lat));
      ctx.lineTo(width, latToY(lat));
      ctx.stroke();
    }

    // Equator
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, latToY(0));
    ctx.lineTo(width, latToY(0));
    ctx.stroke();

    // Draw Student's 15 Grid Nodes
    for (const node of studentNodes) {
      const nx = lonToX(node.lonDeg);
      const ny = latToY(node.latDeg);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Russian Major Cities
    for (const city of RUSSIAN_REGIONS) {
      const cx = lonToX(city.lonDeg);
      const cy = latToY(city.latDeg);
      const isSelected = selectedObserver.id === city.id;

      ctx.fillStyle = isSelected ? '#ef4444' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.fillText(city.name.split(' ')[0], cx + 5, cy - 4);
    }

    // Draw Satellites (Sub-satellite points)
    for (const sat of sats) {
      const sx = lonToX(sat.lon);
      const sy = latToY(sat.lat);

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [coverageData, sats, selectedObserver, displayMode, studentNodes]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const lon = (x / rect.width) * 360 - 180;
    const lat = 90 - (y / rect.height) * 180;

    onCustomCoordSelect(Math.round(lat * 10) / 10, Math.round(lon * 10) / 10);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-sky-400" />
          <h3 className="font-semibold text-sm text-white">Глобальное поле видимости и узлы РФ</h3>
          <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
            {sats.length} КА
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDisplayMode(displayMode === 'satsCount' ? 'pointsOnly' : 'satsCount')}
            className={`px-2.5 py-1 text-xs rounded border transition ${
              displayMode === 'satsCount'
                ? 'bg-sky-600/80 border-sky-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            {displayMode === 'satsCount' ? 'Тепловая карта (Turbo)' : 'Только точки'}
          </button>
          <button
            onClick={computeCoverageGrid}
            disabled={isComputingMap}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
            title="Пересчитать поле видимости"
          >
            <RefreshCw className={`w-3 h-3 ${isComputingMap ? 'animate-spin text-sky-400' : ''}`} />
            <span>{isComputingMap ? 'Расчет...' : 'Обновить'}</span>
          </button>
        </div>
      </div>

      {/* 2D Canvas */}
      <div className="relative w-full rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
        <canvas
          ref={canvasRef}
          width={840}
          height={420}
          onClick={handleCanvasClick}
          className="w-full h-auto cursor-crosshair block"
        />

        {/* Legend */}
        <div className="absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded border border-slate-700 text-[11px] text-slate-300 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Видимость:</span>
            <div className="w-20 h-2.5 rounded bg-gradient-to-r from-blue-900 via-emerald-600 via-amber-500 to-red-600" />
            <span className="text-xs font-mono font-bold">0 .. 18+ КА</span>
          </div>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> 15 узлов РФ
          </span>
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> КА
          </span>
        </div>
      </div>

      {/* Preset Russian cities bar */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
        <span className="text-slate-400 text-[11px] mr-1">Быстрый выбор пункта:</span>
        {RUSSIAN_REGIONS.map((city) => (
          <button
            key={city.id}
            onClick={() => onSelectObserver(city)}
            className={`px-2 py-1 rounded text-[11px] transition ${
              selectedObserver.id === city.id
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            {city.name.split(' ')[0]}
          </button>
        ))}
      </div>
    </div>
  );
};

// Turbo colormap helper
function getTurboColor(value: number, min: number, max: number): string {
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Multi-stop interpolation: Blue -> Cyan -> Green -> Yellow -> Red
  if (norm < 0.2) {
    const t = norm / 0.2;
    return `rgba(15, 23, 42, ${0.4 + t * 0.3})`;
  } else if (norm < 0.4) {
    const t = (norm - 0.2) / 0.2;
    return `rgba(37, 99, 235, ${0.5 + t * 0.2})`;
  } else if (norm < 0.6) {
    const t = (norm - 0.4) / 0.2;
    return `rgba(16, 185, 129, ${0.6 + t * 0.2})`;
  } else if (norm < 0.8) {
    const t = (norm - 0.6) / 0.2;
    return `rgba(245, 158, 11, ${0.7 + t * 0.2})`;
  } else {
    const t = (norm - 0.8) / 0.2;
    return `rgba(239, 68, 68, ${0.8 + t * 0.2})`;
  }
}

// Approximate world continents vector outlines for Canvas
function drawSimplifiedWorldMap(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const lonToX = (lon: number) => ((lon + 180) / 360) * w;
  const latToY = (lat: number) => ((90 - lat) / 180) * h;

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1;

  // Eurasia (including Russia)
  ctx.beginPath();
  ctx.moveTo(lonToX(30), latToY(70));
  ctx.lineTo(lonToX(60), latToY(73));
  ctx.lineTo(lonToX(100), latToY(78));
  ctx.lineTo(lonToX(140), latToY(72));
  ctx.lineTo(lonToX(170), latToY(66));
  ctx.lineTo(lonToX(140), latToY(50));
  ctx.lineTo(lonToX(130), latToY(35));
  ctx.lineTo(lonToX(105), latToY(20));
  ctx.lineTo(lonToX(80), latToY(10));
  ctx.lineTo(lonToX(60), latToY(25));
  ctx.lineTo(lonToX(40), latToY(30));
  ctx.lineTo(lonToX(20), latToY(40));
  ctx.lineTo(lonToX(10), latToY(55));
  ctx.lineTo(lonToX(25), latToY(65));
  ctx.closePath();
  ctx.stroke();

  // Africa
  ctx.beginPath();
  ctx.moveTo(lonToX(-15), latToY(35));
  ctx.lineTo(lonToX(35), latToY(30));
  ctx.lineTo(lonToX(50), latToY(12));
  ctx.lineTo(lonToX(40), latToY(-10));
  ctx.lineTo(lonToX(30), latToY(-34));
  ctx.lineTo(lonToX(18), latToY(-34));
  ctx.lineTo(lonToX(10), latToY(5));
  ctx.lineTo(lonToX(-15), latToY(15));
  ctx.closePath();
  ctx.stroke();

  // North America
  ctx.beginPath();
  ctx.moveTo(lonToX(-165), latToY(65));
  ctx.lineTo(lonToX(-130), latToY(70));
  ctx.lineTo(lonToX(-80), latToY(70));
  ctx.lineTo(lonToX(-60), latToY(45));
  ctx.lineTo(lonToX(-80), latToY(25));
  ctx.lineTo(lonToX(-100), latToY(20));
  ctx.lineTo(lonToX(-120), latToY(35));
  ctx.lineTo(lonToX(-160), latToY(58));
  ctx.closePath();
  ctx.stroke();

  // South America
  ctx.beginPath();
  ctx.moveTo(lonToX(-80), latToY(10));
  ctx.lineTo(lonToX(-35), latToY(-5));
  ctx.lineTo(lonToX(-40), latToY(-22));
  ctx.lineTo(lonToX(-65), latToY(-55));
  ctx.lineTo(lonToX(-75), latToY(-45));
  ctx.lineTo(lonToX(-80), latToY(-5));
  ctx.closePath();
  ctx.stroke();

  // Australia
  ctx.beginPath();
  ctx.moveTo(lonToX(115), latToY(-20));
  ctx.lineTo(lonToX(145), latToY(-15));
  ctx.lineTo(lonToX(150), latToY(-35));
  ctx.lineTo(lonToX(135), latToY(-38));
  ctx.lineTo(lonToX(115), latToY(-32));
  ctx.closePath();
  ctx.stroke();
}
