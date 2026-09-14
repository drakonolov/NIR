import React, { useMemo } from 'react';
import { WalkerConfig, RealisticCostBreakdown } from '../types';
import { CONSTELLATION_PRESETS, evaluateRealisticSystemCost } from '../lib/costModel';
import { RUSSIAN_REGIONS, getStudentGridNodes } from '../lib/orbitPhysics';
import { DollarSign, Rocket, ShieldAlert, CheckCircle2, TrendingDown, Layers, HelpCircle } from 'lucide-react';

interface CostCalculatorProps {
  config: WalkerConfig;
  costBreakdown: RealisticCostBreakdown;
  onApplyPreset: (presetConfig: WalkerConfig) => void;
  onConfigChange: (newConfig: Partial<WalkerConfig>) => void;
}

export const CostCalculator: React.FC<CostCalculatorProps> = ({
  config,
  costBreakdown,
  onApplyPreset,
  onConfigChange,
}) => {
  const observers = useMemo(() => [...RUSSIAN_REGIONS, ...getStudentGridNodes()], []);

  // Pre-calculate winner preset cost for direct comparison
  const winnerPreset = CONSTELLATION_PRESETS[0];
  const winnerCost = useMemo(
    () => evaluateRealisticSystemCost(winnerPreset.config, observers),
    [winnerPreset, observers]
  );

  const capexDifferenceM = costBreakdown.totalCapexM - winnerCost.totalCapexM;
  const capexDiffPct = Math.round((capexDifferenceM / winnerCost.totalCapexM) * 100);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-5">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              Реалистичный калькулятор стоимости (CAPEX) и штрафов
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Экономико-техническая модель с кривой серийности, пусковыми расходами по числу плоскостей P и многокритериальными штрафами.
          </p>
        </div>

        {/* Radiation warning badge */}
        {config.h / 1000 > 1100 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-300 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              h = {(config.h / 1000).toFixed(0)} км: радиационный пояс Ван Аллена (+45% к цене спутника)
            </span>
          </div>
        )}
      </div>

      {/* Preset selection bar */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-300">Пресеты группировок для сравнения:</span>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {CONSTELLATION_PRESETS.map((preset) => {
            const isCurrent =
              config.N === preset.config.N &&
              config.P === preset.config.P &&
              config.h === preset.config.h;
            return (
              <button
                key={preset.id}
                onClick={() => onApplyPreset(preset.config)}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                  isCurrent
                    ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                    : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {preset.badge}
                    </span>
                    {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <div className="font-semibold text-xs text-white leading-snug">{preset.name}</div>
                </div>
                <div className="text-[11px] text-slate-400 line-clamp-2">{preset.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Col 1: Launch costs */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-sm text-white flex items-center gap-1.5">
              <Rocket className="w-4 h-4 text-sky-400" />
              1. Запуски (Ракеты-носители)
            </span>
            <span className="text-xs font-mono font-bold text-sky-400">
              {costBreakdown.totalLaunchCostM.toLocaleString()} млн ₽
            </span>
          </div>

          <div className="flex flex-col gap-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Число орбитальных плоскостей (P):</span>
              <span className="font-bold text-white">{costBreakdown.launchCount} пусков</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">КА в одной плоскости (S):</span>
              <span className="font-semibold">{config.S} аппаратов/пуск</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Стоимость 1 пуска с РБ:</span>
              <span className="font-semibold text-slate-200">
                {costBreakdown.costPerLaunchM.toLocaleString()} млн ₽
              </span>
            </div>
            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-400 mt-1">
              Каждая плоскость выводится отдельной ракетой типа «Союз-2.1б» / «Ангара-А5». Снижение P прямо снижает затраты!
            </div>
          </div>
        </div>

        {/* Col 2: Satellite Production */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-sm text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" />
              2. Производство КА (Серия N)
            </span>
            <span className="text-xs font-mono font-bold text-purple-400">
              {costBreakdown.totalSatellitesCostM.toLocaleString()} млн ₽
            </span>
          </div>

          <div className="flex flex-col gap-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Всего аппаратов (N = P × S):</span>
              <span className="font-bold text-white">{config.N} шт.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Базовая цена головного КА:</span>
              <span>{costBreakdown.baseSatCostM} млн ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Надбавка за радиацию:</span>
              <span className={costBreakdown.radHardSurchargeM > 0 ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                {costBreakdown.radHardSurchargeM > 0 ? `+${costBreakdown.radHardSurchargeM} млн ₽` : '0 ₽ (ниже поясов)'}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1.5">
              <span className="text-slate-400">Серийная цена 1 КА (кривая 88%):</span>
              <span className="font-bold text-emerald-400">{costBreakdown.unitSatCostM} млн ₽</span>
            </div>
          </div>
        </div>

        {/* Col 3: Quality & Penalties */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-sm text-white flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              3. Штрафы фитнес-функции
            </span>
            <span className="text-xs font-mono font-bold text-amber-400">
              Fitness: {costBreakdown.totalFitness.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col gap-2 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Доступность поля (PDOP ≤ 4):</span>
              <span className={`font-bold ${costBreakdown.availabilityPct >= 99 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {costBreakdown.availabilityPct.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Штраф за недоступность:</span>
              <span className="font-mono text-rose-400">+{costBreakdown.outagePenalty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Штраф за геометрию (PDOP):</span>
              <span className="font-mono text-amber-400">+{costBreakdown.dopPenalty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Штраф за дефицит RAIM (&lt;5 КА):</span>
              <span className="font-mono text-amber-400">+{costBreakdown.raimPenalty}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Радиационный риск:</span>
              <span className="font-mono text-rose-400">+{costBreakdown.radiationRiskPenalty}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Total CAPEX Summary Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
            Итоговый бюджет системы (CAPEX):
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {costBreakdown.totalCapexM.toLocaleString()} млн ₽
            </span>
            <span className="text-xs text-slate-400">
              (~{(costBreakdown.totalCapexM / 90).toFixed(1)} млн $)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">Разница с текущим решением (105 КА):</span>
            <span
              className={`text-sm font-bold font-mono ${
                capexDifferenceM < 0 ? 'text-emerald-400' : capexDifferenceM > 0 ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {capexDifferenceM > 0 ? `+${capexDifferenceM.toLocaleString()} млн ₽` : `${capexDifferenceM.toLocaleString()} млн ₽`} ({capexDiffPct > 0 ? `+${capexDiffPct}%` : `${capexDiffPct}%`})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
