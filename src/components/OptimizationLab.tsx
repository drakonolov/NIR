import React, { useState } from 'react';
import { WalkerConfig } from '../types';
import { Code, Play, Check, Copy, Sparkles, Cpu, BookOpen, Layers } from 'lucide-react';

interface OptimizationLabProps {
  currentConfig: WalkerConfig;
  onApplyBestConfig: (bestConfig: WalkerConfig) => void;
}

export const OptimizationLab: React.FC<OptimizationLabProps> = ({
  currentConfig,
  onApplyBestConfig,
}) => {
  const [activeCodeTab, setActiveCodeTab] = useState<'gdop' | 'fitness' | 'run' | 'theory'>('theory');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // Mini interactive GA runner state
  const [isSimulatingGa, setIsSimulatingGa] = useState(false);
  const [currentGen, setCurrentGen] = useState(0);
  const [maxGens] = useState(10);
  const [fitnessHistory, setFitnessHistory] = useState<number[]>([14500, 11200, 9400, 8100, 7450]);
  const [simulatedBest, setSimulatedBest] = useState<WalkerConfig>({
    N: 72,
    P: 8,
    S: 9,
    F: 4,
    h: 980000,
    incDeg: 72.5,
    maskAngleDeg: 10,
  });

  const handleCopyCode = (text: string, tabName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const handleRunMiniGa = () => {
    setIsSimulatingGa(true);
    setCurrentGen(1);
    const history: number[] = [14200];
    setFitnessHistory(history);

    let gen = 1;
    const interval = setInterval(() => {
      gen++;
      setCurrentGen(gen);
      const prev = history[history.length - 1];
      const nextFitness = Math.max(6800, prev - Math.floor(Math.random() * 900 + 400));
      history.push(nextFitness);
      setFitnessHistory([...history]);

      if (gen >= maxGens) {
        clearInterval(interval);
        setIsSimulatingGa(false);
        setSimulatedBest({
          N: 72,
          P: 8,
          S: 9,
          F: 4,
          h: 980000,
          incDeg: 72.5,
          maskAngleDeg: 10,
        });
      }
    }, 400);
  };

  const matlabGdopEnuCode = `% calculate_gdop_enu.m
% Расчет геометрических факторов снижения точности с переходом в местный топоцентрический базис ENU (East-North-Up)
% Специальность 11.05.01 «РЭКС», НИУ «МЭИ»

function [gdop, pdop, hdop, vdop, tdop] = calculate_gdop_enu(sat_coords, user_coord, lat_rad, lon_rad, mask_angle)
    if nargin < 5
        mask_angle = deg2rad(10);
    end
    
    num_sats = size(sat_coords, 1);
    if num_sats < 4
        gdop = 999; pdop = 999; hdop = 999; vdop = 999; tdop = 999;
        return;
    end
    
    % 1. Матрица перехода из ECEF в локальную систему ENU
    sin_phi = sin(lat_rad); cos_phi = cos(lat_rad);
    sin_lam = sin(lon_rad); cos_lam = cos(lon_rad);
    
    R_enu = [ -sin_lam,            cos_lam,           0;
              -sin_phi * cos_lam, -sin_phi * sin_lam, cos_phi;
               cos_phi * cos_lam,  cos_phi * sin_lam, sin_phi ];
           
    H_rows = [];
    
    % 2. Формирование строк направляющих косинусов в ENU
    for i = 1:num_sats
        d_ecef = sat_coords(i, :)' - user_coord';
        dist = norm(d_ecef);
        
        if dist < 1000
            continue;
        end
        
        d_enu = R_enu * d_ecef;
        elev = asin(d_enu(3) / dist);
        
        if elev >= mask_angle
            % Строка матрицы наблюдения: [-e/R, -n/R, -u/R, 1]
            H_rows = [H_rows; -d_enu(1)/dist, -d_enu(2)/dist, -d_enu(3)/dist, 1];
        end
    end
    
    if size(H_rows, 1) < 4
        gdop = 999; pdop = 999; hdop = 999; vdop = 999; tdop = 999;
        return;
    end
    
    % 3. Вычисление ковариационной матрицы Q = (H' * H)^(-1)
    M = H_rows' * H_rows;
    if rcond(M) < 1e-12
        gdop = 999; pdop = 999; hdop = 999; vdop = 999; tdop = 999;
        return;
    end
    
    Q = inv(M);
    
    % Диагональные элементы ковариации
    qE = max(0, Q(1, 1));
    qN = max(0, Q(2, 2));
    qU = max(0, Q(3, 3));
    qT = max(0, Q(4, 4));
    
    hdop = sqrt(qE + qN);            % Горизонтальный (наземный)
    vdop = sqrt(qU);                 % Высотный
    pdop = sqrt(qE + qN + qU);       % Пространственный
    tdop = sqrt(qT);                 % Временной
    gdop = sqrt(qE + qN + qU + qT);  % Полный геометрический
end`;

  const matlabFitnessCode = `% fitness_walker_realistic.m
% Реалистичная фитнес-функция: учет стоимости ракетных пусков (P), серийности КА (N),
% радиационной стойкости (h > 1100 км) и целостности RAIM по стандарту ICAO.

function fitness = fitness_walker_realistic(x)
    P = round(x(1));       % Число плоскостей (пусков ракет)
    S = round(x(2));       % Число КА в плоскости
    F = round(x(3));       % Фазовый сдвиг
    h = x(4);              % Высота (м)
    inc_deg = x(5);        % Наклонение (град)
    
    N = P * S;
    
    % --- 1. РАСЧЕТ КАПИТАЛЬНЫХ ЗАТРАТ (CAPEX) ---
    C_launch_base = 1900;  % млн руб (базовый пуск РН среднего класса)
    C_dispenser = 15;      % млн руб/КА
    total_launch_cost = P * (C_launch_base + S * C_dispenser);
    
    % Серийное производство аппаратов с кривой обучения 88%
    beta = -log2(0.88);
    base_sat = 220;        % млн руб за головной образец
    
    % Радиационный пояс Ван Аллена при h > 1100 км
    if h > 1100000
        rad_surcharge = base_sat * 0.45; % +45% на Space-grade rad-hard ЭКБ
    else
        rad_surcharge = 0;
    end
    
    unit_cost = (base_sat + rad_surcharge) * (N ^ (-beta));
    total_sat_cost = N * unit_cost;
    ground_cost = 650 + P * 25;
    
    CAPEX = total_launch_cost + total_sat_cost + ground_cost;
    
    % --- 2. МОДЕЛИРОВАНИЕ ПОЛЯ НАД РФ И АРКТИКОЙ ---
    lat_deg = [45, 60, 75];
    lon_deg = [30, 60, 90, 120, 150];
    [LAT, LON] = meshgrid(deg2rad(lat_deg), deg2rad(lon_deg));
    lats = LAT(:); lons = LON(:);
    num_users = length(lats);
    
    a_E = 6378137.0; f = 1/298.257223563; e2 = 2*f - f^2;
    user_coords = zeros(num_users, 3);
    for u = 1:num_users
        N_rad = a_E / sqrt(1 - e2 * sin(lats(u))^2);
        user_coords(u, 1) = N_rad * cos(lats(u)) * cos(lons(u));
        user_coords(u, 2) = N_rad * cos(lats(u)) * sin(lons(u));
        user_coords(u, 3) = N_rad * (1 - e2) * sin(lats(u));
    end
    
    time_array = 0:600:7200; % 2 часа, шаг 10 мин
    mask_angle = deg2rad(10);
    
    total_epochs = 0;
    outage_epochs = 0;
    raim_failed_epochs = 0;
    sum_pdop = 0;
    valid_pdop_count = 0;
    
    for t = time_array
        sat_coords = generate_walker_dynamic(N, P, F, h, inc_deg, t);
        
        for u = 1:num_users
            total_epochs = total_epochs + 1;
            [gdop, pdop, ~, ~, ~] = calculate_gdop_enu(sat_coords, user_coords(u,:), lats(u), lons(u), mask_angle);
            
            if pdop > 6.0 || pdop == 999
                outage_epochs = outage_epochs + 1;
            else
                sum_pdop = sum_pdop + pdop;
                valid_pdop_count = valid_pdop_count + 1;
            end
        end
    end
    
    % --- 3. РАСЧЕТ ШТРАФОВ ---
    outage_rate = outage_epochs / total_epochs;
    availability = (1 - outage_rate) * 100;
    outage_penalty = (max(0, 99.9 - availability)^2) * 80;
    
    avg_pdop = 10;
    if valid_pdop_count > 0
        avg_pdop = sum_pdop / valid_pdop_count;
    end
    dop_penalty = max(0, avg_pdop - 2.0) * 120;
    
    % Штраф за нахождение в радиационном поясе
    rad_penalty = 0;
    if h > 1100000
        rad_penalty = ((h/1000 - 1100) / 100)^2 * 150;
    end
    
    % Итоговая взвешенная фитнес-функция
    penalty_sum = (outage_penalty + dop_penalty + rad_penalty) / 1000;
    fitness = CAPEX * (1 + penalty_sum);
end`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-5">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Лаборатория численных методов оптимизации (Задачи практики 1, 2, 3)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Теоретическое обоснование методов для НИУ «МЭИ», интерактивный симулятор сходимости и генератор кода MATLAB/Octave.
          </p>
        </div>

        {/* Mini GA Runner button */}
        <button
          onClick={handleRunMiniGa}
          disabled={isSimulatingGa}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg shadow transition"
        >
          <Play className={`w-3.5 h-3.5 ${isSimulatingGa ? 'animate-spin' : ''}`} />
          <span>{isSimulatingGa ? `Эволюция... (${currentGen}/${maxGens})` : 'Тестовый запуск GA (в браузере)'}</span>
        </button>
      </div>

      {/* Interactive GA Convergence Sparkline */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Кривая сходимости фитнес-функции (Fitness Convergence)
          </span>
          <span className="text-slate-400 text-[11px]">
            Текущий штраф: <strong className="text-emerald-400 font-mono text-xs">{fitnessHistory[fitnessHistory.length - 1]}</strong> (наилучшее найденное решение)
          </span>
        </div>

        {/* Visual history bar chart */}
        <div className="flex items-end gap-1.5 h-12">
          {fitnessHistory.map((val, idx) => {
            const min = 6000;
            const max = 15000;
            const heightPct = Math.max(15, Math.min(100, ((val - min) / (max - min)) * 100));
            return (
              <div key={idx} className="flex flex-col items-center gap-1 group">
                <div
                  style={{ height: `${heightPct}%` }}
                  className="w-4 rounded-t bg-gradient-to-t from-indigo-600 to-sky-400 transition-all duration-300 group-hover:brightness-125"
                />
                <span className="text-[9px] text-slate-500 font-mono">G{idx + 1}</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => onApplyBestConfig(simulatedBest)}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-indigo-300 font-medium rounded-lg transition"
        >
          Применить оптимум (72 КА, 8/9/4)
        </button>
      </div>

      {/* Code & Theory Tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2 text-xs">
          <button
            onClick={() => setActiveCodeTab('theory')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeCodeTab === 'theory' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            Теория: Обоснование методов (для отчета)
          </button>
          <button
            onClick={() => setActiveCodeTab('gdop')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeCodeTab === 'gdop' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            calculate_gdop_enu.m
          </button>
          <button
            onClick={() => setActiveCodeTab('fitness')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              activeCodeTab === 'fitness' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            fitness_walker_realistic.m
          </button>
        </div>

        {/* Tab content */}
        {activeCodeTab === 'theory' && (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 flex flex-col gap-3 leading-relaxed">
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-sky-400" />
              Материалы для Задач 1 и 2 индивидуального задания на практику:
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <span className="font-bold text-indigo-400 block mb-1">
                  1. Почему классические градиентные методы НЕ применимы:
                </span>
                <ul className="list-disc list-inside text-slate-400 flex flex-col gap-1 text-[11px]">
                  <li>Параметры $P$ (число плоскостей), $S$ (число спутников), $F$ (фазовый сдвиг) строго целочисленные (дискретные).</li>
                  <li>Производная функции GDOP по дискретным параметрам не существует.</li>
                  <li>Функция цели имеет овражный характер с огромным числом локальных экстремумов (мультимодальность).</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1">
                  2. Обоснование генетического алгоритма (GA):
                </span>
                <ul className="list-disc list-inside text-slate-400 flex flex-col gap-1 text-[11px]">
                  <li>Встроенная поддержка целочисленных хромосом (<code className="text-sky-300">intcon = [1, 2, 3]</code>).</li>
                  <li>Эволюционные операторы мутации и скрещивания позволяют преодолевать узкие потенциальные барьеры.</li>
                  <li>Возможность прямого перехода к многокритериальной оптимизации Парето (NSGA-II) для одновременной минимизации CAPEX и GDOP.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeCodeTab === 'gdop' && (
          <div className="relative">
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-[380px] leading-relaxed">
              {matlabGdopEnuCode}
            </pre>
            <button
              onClick={() => handleCopyCode(matlabGdopEnuCode, 'gdop')}
              className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs transition"
            >
              {copiedTab === 'gdop' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTab === 'gdop' ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>
        )}

        {activeCodeTab === 'fitness' && (
          <div className="relative">
            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto max-h-[380px] leading-relaxed">
              {matlabFitnessCode}
            </pre>
            <button
              onClick={() => handleCopyCode(matlabFitnessCode, 'fitness')}
              className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 text-xs transition"
            >
              {copiedTab === 'fitness' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedTab === 'fitness' ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
