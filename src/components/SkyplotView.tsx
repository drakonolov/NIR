import React from 'react';
import { DopBreakdown, GroundObserver } from '../types';
import { ShieldCheck, ShieldAlert, Radio, Clock, Navigation, MapPin } from 'lucide-react';

interface SkyplotViewProps {
  dopInfo: DopBreakdown;
  observer: GroundObserver;
  maskAngleDeg: number;
}

export const SkyplotView: React.FC<SkyplotViewProps> = ({
  dopInfo,
  observer,
  maskAngleDeg,
}) => {
  const size = 320;
  const center = size / 2;
  const radius = center - 24;

  // Функция перевода азимута и угла места в координаты холста (r, theta)
  // В полярном скайплоте зенит (el=90) в центре (r=0), горизонт (el=0) на краю (r=radius).
  const getSkyCoords = (azimuthDeg: number, elevationDeg: number) => {
    const clampedEl = Math.max(0, Math.min(90, elevationDeg));
    const r = (radius * (90 - clampedEl)) / 90;
    const rad = ((azimuthDeg - 90) * Math.PI) / 180; // 0 deg = North (top)
    return {
      x: center + r * Math.cos(rad),
      y: center + r * Math.sin(rad),
    };
  };

  // RAIM статус
  let raimBadge = {
    text: 'Недостаточно КА для RAIM (<5)',
    status: 'bad',
    description: 'Невозможно обнаружить отказ единичного спутника',
  };
  if (dopInfo.numSats >= 6) {
    raimBadge = {
      text: 'RAIM FDE доступен (≥6 КА)',
      status: 'good',
      description: 'Обнаружение и исключение аномального спутника по стандарту ICAO',
    };
  } else if (dopInfo.numSats === 5) {
    raimBadge = {
      text: 'RAIM FD доступен (5 КА)',
      status: 'warning',
      description: 'Обнаружение сбоя без возможности исключения (Fault Detection)',
    };
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-400" />
          <h3 className="font-semibold text-sm text-white">Небосвод наблюдателя (Skyplot)</h3>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          {observer.name} ({observer.latDeg.toFixed(1)}°N, {observer.lonDeg.toFixed(1)}°E)
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* Skyplot SVG */}
        <div className="flex justify-center items-center">
          <svg width={size} height={size} className="overflow-visible select-none">
            {/* Background circle */}
            <circle cx={center} cy={center} r={radius} fill="#090d16" stroke="#1e293b" strokeWidth="2" />

            {/* Elevation Rings: 30 deg, 60 deg */}
            <circle cx={center} cy={center} r={(radius * 60) / 90} fill="none" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
            <circle cx={center} cy={center} r={(radius * 30) / 90} fill="none" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />

            {/* Mask Angle Circle */}
            <circle
              cx={center}
              cy={center}
              r={(radius * (90 - maskAngleDeg)) / 90}
              fill="none"
              stroke="#e11d48"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Crosshairs */}
            <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="#1e293b" strokeWidth="1" />
            <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="#1e293b" strokeWidth="1" />

            {/* Labels N, E, S, W */}
            <text x={center} y={center - radius - 6} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">С (0°)</text>
            <text x={center + radius + 12} y={center + 4} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">В (90°)</text>
            <text x={center} y={center + radius + 14} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">Ю (180°)</text>
            <text x={center - radius - 14} y={center + 4} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="bold">З (270°)</text>

            {/* Elevation labels */}
            <text x={center + 4} y={center - (radius * 60) / 90 + 3} fill="#475569" fontSize="9">30°</text>
            <text x={center + 4} y={center - (radius * 30) / 90 + 3} fill="#475569" fontSize="9">60°</text>
            <text x={center + 4} y={center - 4} fill="#38bdf8" fontSize="9" fontWeight="bold">Zenith (90°)</text>

            {/* Mask angle label */}
            <text x={center + 4} y={center - (radius * (90 - maskAngleDeg)) / 90 + 3} fill="#f43f5e" fontSize="9">
              Маска {maskAngleDeg}°
            </text>

            {/* Visible Satellites */}
            {dopInfo.visibleSats.map((sat) => {
              const { x, y } = getSkyCoords(sat.azimuthDeg, sat.elevationDeg);
              return (
                <g key={sat.id} className="group cursor-pointer">
                  {/* Outer pulse circle */}
                  <circle cx={x} cy={y} r="10" fill="rgba(34, 197, 94, 0.2)" className="group-hover:fill-emerald-400/40 transition" />
                  {/* Sat dot */}
                  <circle cx={x} cy={y} r="5" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
                  {/* Label */}
                  <text
                    x={x + 7}
                    y={y - 7}
                    fill="#e2e8f0"
                    fontSize="10"
                    fontWeight="bold"
                    className="group-hover:fill-white drop-shadow"
                  >
                    #{sat.id}
                  </text>
                  {/* SVG Tooltip */}
                  <title>
                    {`КА #${sat.id}\nУгол места: ${sat.elevationDeg.toFixed(1)}°\nАзимут: ${sat.azimuthDeg.toFixed(1)}°\nДальность: ${sat.rangeKm.toFixed(0)} км\nДоплер: ${sat.dopplerKhz.toFixed(1)} кГц\nFSPL: ${sat.fsplDb.toFixed(1)} дБ`}
                  </title>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Metrics Column */}
        <div className="flex flex-col gap-3 text-xs">
          {/* RAIM Box */}
          <div
            className={`p-2.5 rounded-lg border flex items-start gap-2 ${
              raimBadge.status === 'good'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : raimBadge.status === 'warning'
                ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                : 'bg-rose-950/40 border-rose-800 text-rose-300'
            }`}
          >
            {raimBadge.status === 'good' ? (
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold text-[13px]">{raimBadge.text}</div>
              <div className="text-[11px] opacity-80 mt-0.5">{raimBadge.description}</div>
            </div>
          </div>

          {/* DOP Breakdown Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">PDOP (Пространственный)</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-base font-bold ${dopInfo.pdop <= 3.0 ? 'text-emerald-400' : dopInfo.pdop <= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {dopInfo.pdop < 900 ? dopInfo.pdop.toFixed(2) : '—'}
                </span>
                <span className="text-[10px] text-slate-400">(порог ≤ 3.5)</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">HDOP (Горизонтальный)</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold text-sky-400">
                  {dopInfo.hdop < 900 ? dopInfo.hdop.toFixed(2) : '—'}
                </span>
                <span className="text-[10px] text-slate-400">наземная точность</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">VDOP (Вертикальный)</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold text-purple-400">
                  {dopInfo.vdop < 900 ? dopInfo.vdop.toFixed(2) : '—'}
                </span>
                <span className="text-[10px] text-slate-400">высотная точность</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">TDOP (Временной)</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold text-amber-400">
                  {dopInfo.tdop < 900 ? dopInfo.tdop.toFixed(2) : '—'}
                </span>
                <span className="text-[10px] text-slate-400">уход часов</span>
              </div>
            </div>
          </div>

          {/* Visible Satellites Quick List */}
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400 font-medium mb-1.5 flex items-center justify-between">
              <span>Видимые спутники ({dopInfo.visibleSats.length} шт.):</span>
              <span className="text-[10px] text-slate-500">Доплер: ±50 кГц</span>
            </div>
            <div className="max-h-24 overflow-y-auto pr-1 flex flex-wrap gap-1.5">
              {dopInfo.visibleSats.map((sat) => (
                <div
                  key={sat.id}
                  className="bg-slate-800/80 px-2 py-0.5 rounded text-[11px] text-slate-300 flex items-center gap-1.5 border border-slate-700/50"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="font-semibold text-white">#{sat.id}</span>
                  <span className="text-slate-400">{sat.elevationDeg.toFixed(0)}°</span>
                  <span className="text-sky-400 font-mono text-[10px]">
                    {sat.dopplerKhz > 0 ? `+${sat.dopplerKhz.toFixed(1)}` : sat.dopplerKhz.toFixed(1)}k
                  </span>
                </div>
              ))}
              {dopInfo.visibleSats.length === 0 && (
                <div className="text-slate-500 italic text-[11px]">Нет КА в зоне радиовидимости</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
