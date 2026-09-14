import React, { useState, useEffect, useMemo } from 'react';
import { GroundObserver, WalkerConfig } from './types';
import {
  generateWalkerConstellation,
  calculateDopEnu,
  RUSSIAN_REGIONS,
  getStudentGridNodes,
} from './lib/orbitPhysics';
import { evaluateRealisticSystemCost, CONSTELLATION_PRESETS } from './lib/costModel';
import { ThreeGlobe } from './components/ThreeGlobe';
import { SkyplotView } from './components/SkyplotView';
import { WorldCoverageMap } from './components/WorldCoverageMap';
import { CostCalculator } from './components/CostCalculator';
import { ModelRealismAudit } from './components/ModelRealismAudit';
import { OptimizationLab } from './components/OptimizationLab';
import { AiAdvisorChat } from './components/AiAdvisorChat';
import {
  Orbit,
  Globe,
  DollarSign,
  Cpu,
  FileCheck,
  Bot,
  Sliders,
  AlertTriangle,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

export default function App() {
  // Current Walker Constellation Configuration
  // Starts with student's winner configuration (105 sats: 7 planes, 15 sats/plane, F=5, h=1493 km, i=71°)
  const [config, setConfig] = useState<WalkerConfig>({
    N: 105,
    P: 7,
    S: 15,
    F: 5,
    h: 1493000,
    incDeg: 71.0,
    maskAngleDeg: 10,
  });

  // Selected Ground Observer
  const [selectedObserver, setSelectedObserver] = useState<GroundObserver>(RUSSIAN_REGIONS[0]); // Moscow

  // Simulation Time (seconds)
  const [simTimeSeconds, setSimTimeSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Active Main Navigation Tab
  const [activeTab, setActiveTab] = useState<
    'visualization' | 'map' | 'cost' | 'audit' | 'optimization' | 'advisor'
  >('visualization');

  // Animation Loop for real-time constellation orbit propagation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimTimeSeconds((prev) => (prev + 30) % 86400);
    }, 500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Propagate Satellites at current sim time
  const sats = useMemo(() => {
    return generateWalkerConstellation(config, simTimeSeconds);
  }, [config, simTimeSeconds]);

  // Calculate DOP in topocentric ENU at current observer
  const dopInfo = useMemo(() => {
    return calculateDopEnu(
      sats,
      selectedObserver.latDeg,
      selectedObserver.lonDeg,
      selectedObserver.altM,
      config.maskAngleDeg
    );
  }, [sats, selectedObserver, config.maskAngleDeg]);

  // Calculate Cost Breakdown and Penalties
  const allRussianObservers = useMemo(() => [...RUSSIAN_REGIONS, ...getStudentGridNodes()], []);
  const costBreakdown = useMemo(() => {
    return evaluateRealisticSystemCost(config, allRussianObservers);
  }, [config, allRussianObservers]);

  // Handlers for parameter changes
  const handlePChange = (newP: number) => {
    const P = Math.max(1, Math.min(30, newP));
    const S = config.S;
    const F = Math.min(config.F, P - 1);
    setConfig({ ...config, P, N: P * S, F });
  };

  const handleSChange = (newS: number) => {
    const S = Math.max(1, Math.min(30, newS));
    const P = config.P;
    setConfig({ ...config, S, N: P * S });
  };

  const handleFChange = (newF: number) => {
    const F = Math.max(0, Math.min(config.P - 1, newF));
    setConfig({ ...config, F });
  };

  const handleAltKmChange = (altKm: number) => {
    setConfig({ ...config, h: altKm * 1000 });
  };

  const handleIncChange = (incDeg: number) => {
    setConfig({ ...config, incDeg });
  };

  const handleMaskChange = (maskAngleDeg: number) => {
    setConfig({ ...config, maskAngleDeg });
  };

  const handleCustomCoordSelect = (lat: number, lon: number) => {
    setSelectedObserver({
      id: `custom-${lat}-${lon}`,
      name: `Точка (${lat}°N, ${lon}°E)`,
      latDeg: lat,
      lonDeg: lon,
      altM: 0,
      weight: 1.0,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Academic Bar */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 sticky top-0 z-50 backdrop-blur-md px-4 py-2.5 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow">
              <Orbit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  НИУ «МЭИ» • Кафедра РЭКС • 11.05.01
                </span>
                <span className="text-[10px] bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded-full font-mono">
                  НИР & Практика
                </span>
              </div>
              <h1 className="text-sm md:text-base font-extrabold text-white leading-tight">
                LEO PNT Walker Optimizer: Реалистичная модель, баллистика и стоимость
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-slate-400 text-[11px]">Исследователь:</span>
              <span className="font-semibold text-slate-200">Даниил Филипченков</span>
            </div>
            <div className="h-8 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400">Конфигурация:</span>
              <span className="font-bold text-amber-400 font-mono">
                {config.N} КА ({config.P}/{config.S}/{config.F})
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col gap-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 text-xs shadow-sm">
          <button
            id="tab-btn-viz"
            onClick={() => setActiveTab('visualization')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition ${
              activeTab === 'visualization'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Orbit className="w-4 h-4" />
            <span>3D Орбиты & Skyplot</span>
          </button>

          <button
            id="tab-btn-map"
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition ${
              activeTab === 'map'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Глобальное поле видимости РФ</span>
          </button>

          <button
            id="tab-btn-cost"
            onClick={() => setActiveTab('cost')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition ${
              activeTab === 'cost'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Стоимость (CAPEX) & Штрафы</span>
          </button>

          <button
            id="tab-btn-audit"
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition ${
              activeTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Научный аудит модели</span>
          </button>

          <button
            id="tab-btn-opt"
            onClick={() => setActiveTab('optimization')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition ${
              activeTab === 'optimization'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Численные методы & MATLAB</span>
          </button>

          <button
            id="tab-btn-advisor"
            onClick={() => setActiveTab('advisor')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition ml-auto ${
              activeTab === 'advisor'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'bg-slate-800 text-indigo-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <Bot className="w-4 h-4 text-amber-300" />
            <span>AI Консультант МЭИ</span>
          </button>
        </div>

        {/* Global Parameter Controls Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Параметры орбитальной группировки Уокера (Walker Delta)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Быстрый пресет:</span>
              {CONSTELLATION_PRESETS.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setConfig(p.config)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                >
                  {p.config.N} КА ({p.config.P}/{p.config.S})
                </button>
              ))}
            </div>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            {/* P: Planes */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Плоскости (P):</span>
                <span className="font-bold text-sky-400 font-mono">{config.P}</span>
              </div>
              <input
                id="input-param-p"
                type="range"
                min={2}
                max={20}
                value={config.P}
                onChange={(e) => handlePChange(Number(e.target.value))}
                className="accent-sky-500 cursor-pointer h-1.5 bg-slate-700 rounded"
              />
              <span className="text-[10px] text-slate-500">= {config.P} пусков ракет</span>
            </div>

            {/* S: Sats per plane */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>КА в плоск. (S):</span>
                <span className="font-bold text-sky-400 font-mono">{config.S}</span>
              </div>
              <input
                id="input-param-s"
                type="range"
                min={2}
                max={24}
                value={config.S}
                onChange={(e) => handleSChange(Number(e.target.value))}
                className="accent-sky-500 cursor-pointer h-1.5 bg-slate-700 rounded"
              />
              <span className="text-[10px] text-slate-500">Всего N = {config.N} КА</span>
            </div>

            {/* F: Phase shift */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Фазовый сдвиг (F):</span>
                <span className="font-bold text-purple-400 font-mono">{config.F}</span>
              </div>
              <input
                id="input-param-f"
                type="range"
                min={0}
                max={Math.max(1, config.P - 1)}
                value={config.F}
                onChange={(e) => handleFChange(Number(e.target.value))}
                className="accent-purple-500 cursor-pointer h-1.5 bg-slate-700 rounded"
              />
              <span className="text-[10px] text-slate-500">0 .. {config.P - 1}</span>
            </div>

            {/* Altitude h */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Высота (h):</span>
                <span className="font-bold text-emerald-400 font-mono">{(config.h / 1000).toFixed(0)} км</span>
              </div>
              <input
                id="input-param-h"
                type="range"
                min={500}
                max={2000}
                step={20}
                value={config.h / 1000}
                onChange={(e) => handleAltKmChange(Number(e.target.value))}
                className="accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded"
              />
              <span className="text-[10px] text-slate-500">
                {config.h / 1000 > 1100 ? '⚠️ В поясе Ван Аллена' : 'Чистая LEO'}
              </span>
            </div>

            {/* Inclination */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Наклонение (i):</span>
                <span className="font-bold text-amber-400 font-mono">{config.incDeg.toFixed(1)}°</span>
              </div>
              <input
                id="input-param-inc"
                type="range"
                min={50}
                max={90}
                step={0.5}
                value={config.incDeg}
                onChange={(e) => handleIncChange(Number(e.target.value))}
                className="accent-amber-500 cursor-pointer h-1.5 bg-slate-700 rounded"
              />
              <span className="text-[10px] text-slate-500">Опт. для РФ: 70° .. 76°</span>
            </div>

            {/* Elevation Mask */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex flex-col gap-1">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Маска угла места:</span>
                <span className="font-bold text-rose-400 font-mono">{config.maskAngleDeg}°</span>
              </div>
              <input
                id="input-param-mask"
                type="range"
                min={5}
                max={25}
                step={1}
                value={config.maskAngleDeg}
                onChange={(e) => handleMaskChange(Number(e.target.value))}
                className="accent-rose-500 cursor-pointer h-1.5 bg-slate-700 rounded"
              />
              <span className="text-[10px] text-slate-500">Город / Рельеф: 10°..15°</span>
            </div>
          </div>
        </div>

        {/* Tab Views */}
        {activeTab === 'visualization' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* 3D Globe Column (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <ThreeGlobe
                config={config}
                sats={sats}
                selectedObserver={selectedObserver}
                dopInfo={dopInfo}
                simTimeSeconds={simTimeSeconds}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(!isPlaying)}
                onTimeChange={(t) => setSimTimeSeconds(t)}
              />
            </div>

            {/* Skyplot & Observer Column (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <SkyplotView
                dopInfo={dopInfo}
                observer={selectedObserver}
                maskAngleDeg={config.maskAngleDeg}
              />
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <WorldCoverageMap
            config={config}
            sats={sats}
            selectedObserver={selectedObserver}
            onSelectObserver={(obs) => setSelectedObserver(obs)}
            onCustomCoordSelect={handleCustomCoordSelect}
          />
        )}

        {activeTab === 'cost' && (
          <CostCalculator
            config={config}
            costBreakdown={costBreakdown}
            onApplyPreset={(p) => setConfig(p)}
            onConfigChange={(newVals) => setConfig({ ...config, ...newVals })}
          />
        )}

        {activeTab === 'audit' && <ModelRealismAudit />}

        {activeTab === 'optimization' && (
          <OptimizationLab
            currentConfig={config}
            onApplyBestConfig={(best) => setConfig(best)}
          />
        )}

        {activeTab === 'advisor' && <AiAdvisorChat config={config} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-3 px-4 text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            НИУ «МЭИ», кафедра радиотехнических систем (РЭКС). Моделирование баллистики и PNT-сервиса группировок Уокера.
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <span>WGS-84 / ECEF / ENU</span>
            <span>•</span>
            <span>J2 Gravitational Drift</span>
            <span>•</span>
            <span>Van Allen Belt Radiation Surcharge</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
