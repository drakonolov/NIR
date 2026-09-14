import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Cpu, Rocket, Radio, Orbit, Activity, Compass, FileCheck } from 'lucide-react';

export const ModelRealismAudit: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ballistics' | 'link' | 'coords' | 'cost' | 'raim'>('ballistics');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold text-white">
            Научный аудит: «Как сделать модель спутниковой системы реалистичной»
          </h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Анализ исходных скриптов MATLAB (<code className="text-sky-300">calculate_gdop.m</code>,{' '}
          <code className="text-sky-300">generate_walker_dynamic.m</code>,{' '}
          <code className="text-sky-300">fitness_walker.m</code>) с точки зрения специальности 11.05.01 «Радиоэлектронные системы и комплексы» (НИУ «МЭИ»).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setActiveTab('ballistics')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition ${
            activeTab === 'ballistics'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <Orbit className="w-3.5 h-3.5" />
          <span>1. Орбитальная физика и среда</span>
        </button>
        <button
          onClick={() => setActiveTab('coords')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition ${
            activeTab === 'coords'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>2. Матрица H и система ENU</span>
        </button>
        <button
          onClick={() => setActiveTab('link')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition ${
            activeTab === 'link'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>3. Радиолиния и Доплер</span>
        </button>
        <button
          onClick={() => setActiveTab('raim')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition ${
            activeTab === 'raim'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>4. Целостность RAIM / ICAO</span>
        </button>
        <button
          onClick={() => setActiveTab('cost')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition ${
            activeTab === 'cost'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>5. Экономика и штрафы</span>
        </button>
      </div>

      {/* Content for active tab */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-300 leading-relaxed flex flex-col gap-4">
        {activeTab === 'ballistics' && (
          <>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Orbit className="w-4 h-4" />
              <span>Орбитальные возмущения, радиационные пояса и плотность атмосферы</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/90 border border-rose-900/40 p-3 rounded-lg flex flex-col gap-2">
                <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> В текущей модели:
                </span>
                <p className="text-slate-400">
                  Учитывается только вторая гармоника геопотенциала J2 = 1.0826 × 10⁻³ (вековая прецессия долготы восходящего узла dΩ/dt и аргумента широты du/dt). Орбита считается строго круговой, среда — абсолютный вакуум.
                </p>
                <div className="bg-slate-950 p-2 rounded font-mono text-[11px] text-slate-300">
                  dOmega = -1.5 * J2 * (a_E / r)^2 * n * cos(inc);
                </div>
              </div>

              <div className="bg-slate-900/90 border border-emerald-900/40 p-3 rounded-lg flex flex-col gap-2">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Что необходимо для реальной системы:
                </span>
                <ul className="list-disc list-inside flex flex-col gap-1 text-slate-300">
                  <li>
                    <strong className="text-white">Радиационные пояса Ван Аллена (Van Allen Belts):</strong> Выбранная вами высота <code className="text-amber-300">h = 1493 км</code> попадает во внутренний радиационный пояс протонов! Накопленная доза (TID) за 5 лет превышает 80–120 крад. Это вынуждает использовать сверхдорогую радиационно-стойкую ЭКБ (Space-grade rad-hard) и ведет к быстрой деградации кремниевых солнечных батарей.
                  </li>
                  <li>
                    <strong className="text-white">Оптимальный коридор высот LEO:</strong> Рекомендуется спуститься в диапазон <code className="text-emerald-300">h = 900 ... 1100 км</code>. Здесь радиационный фон в 10–20 раз ниже, а атмосферное торможение уже пренебрежимо мало.
                  </li>
                  <li>
                    <strong className="text-white">Атмосферное торможение при $h &lt; 600$ км:</strong> Плотность атмосферы $\rho(h)$ вызывает потерю высоты до 15-30 км в год. Необходим расчет баллистического коэффициента $\sigma = C_D A / m$ и характеристической скорости $\Delta V$ на компенсацию торможения.
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}

        {activeTab === 'coords' && (
          <>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Compass className="w-4 h-4" />
              <span>Переход из геоцентрической системы ECEF в топоцентрическую ENU</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/90 border border-rose-900/40 p-3 rounded-lg flex flex-col gap-2">
                <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Ошибка в текущем расчете calculate_gdop.m:
                </span>
                <p className="text-slate-400">
                  Матрица направляющих косинусов $H$ строится в декартовой геоцентрической системе координат ECEF (WGS84):
                </p>
                <div className="bg-slate-950 p-2 rounded font-mono text-[11px] text-slate-300">
                  H(i, :) = [dx/R, dy/R, dz/R, 1];<br />
                  Q = inv(H' * H);<br />
                  gdop = sqrt(abs(trace(Q)));
                </div>
                <p className="text-rose-300 text-[11px]">
                  След матрицы trace(Q) в ECEF дает только полный GDOP. Вы не можете разделить ошибку на горизонтальную (HDOP) и вертикальную (VDOP)!
                </p>
              </div>

              <div className="bg-slate-900/90 border border-emerald-900/40 p-3 rounded-lg flex flex-col gap-2">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Решение: Ортогональное преобразование в ENU
                </span>
                <p className="text-slate-300">
                  Вектор расстояния d_ECEF поворачивается в местный топоцентрический горизонт наблюдателя с широтой φ и долготой λ:
                </p>
                <div className="bg-slate-950 p-2 rounded font-mono text-[11px] text-emerald-300">
                  e = -sin(λ)*dx + cos(λ)*dy;<br />
                  n = -sin(φ)*cos(λ)*dx - sin(φ)*sin(λ)*dy + cos(φ)*dz;<br />
                  u =  cos(φ)*cos(λ)*dx + cos(φ)*sin(λ)*dy + sin(φ)*dz;
                </div>
                <p className="text-slate-300 text-[11px]">
                  После этого диагональ Q = inv(H_ENU' * H_ENU) дает:<br />
                  HDOP = √(q_EE + q_NN) (точность на плоскости земли),<br />
                  VDOP = √q_UU (точность по высоте),<br />
                  TDOP = √q_tt (погрешность шкалы времени).
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'link' && (
          <>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Radio className="w-4 h-4" />
              <span>Энергетика радиолинии, доплеровский сдвиг и атмосферные задержки</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/90 border border-amber-900/40 p-3 rounded-lg flex flex-col gap-2">
                <span className="font-semibold text-amber-300">Узкие места чисто геометрической маски ($10^\circ$):</span>
                <p className="text-slate-400">
                  В вашей модели спутник считается видимым мгновенно при $\theta \ge 10^\circ$. В радиоэлектронике (кафедра РЭКС) необходимо оценивать энергетический потенциал:
                </p>
                <ul className="list-disc list-inside flex flex-col gap-1 text-slate-300">
                  <li>
                    <strong>Потери в свободном пространстве (FSPL):</strong> Наклонная дальность меняется от $d = h = 1493$ км (в зените) до $d \approx 3600$ км (на угле места 10°). Перепад мощности сигнала превышает $7.6$ дБ!
                  </li>
                  <li>
                    <strong>Городские условия (Urban Canyon):</strong> В городах и на пересеченной местности маска места должна составлять не менее 15–20°, иначе сигнал экранируется застройкой.
                  </li>
                </ul>
              </div>

              <div className="bg-slate-900/90 border border-sky-900/40 p-3 rounded-lg flex flex-col gap-2">
                <span className="font-semibold text-sky-300">Динамика сигнала на LEO (доплеровский сдвиг):</span>
                <p className="text-slate-300">
                  В отличие от среднеорбитальных ГНСС (ГЛОНАСС/GPS на $h \approx 20000$ км, где доплер $\pm 4$ кГц), на низкой орбите спутник летит со скоростью $\sim 7.2$ км/с:
                </p>
                <div className="bg-slate-950 p-2 rounded font-mono text-[11px] text-sky-300">
                  f_D = - (f_0 / c) * (v_rel · e_LOS) ≈ ±45 ... ±65 кГц<br />
                  df_D / dt (Doppler drift) ≈ до 60 ... 100 Гц/с!
                </div>
                <p className="text-slate-300 text-[11px]">
                  Это критический параметр для курсовой/дипломной работы: приемник требует быстрой схемы частотного захвата (FLL) и расширенного диапазона поиска по частоте.
                </p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'raim' && (
          <>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Автономный контроль целостности в приемнике (RAIM) по стандартам ICAO</span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 flex flex-col gap-2.5">
              <p className="text-slate-300">
                В исходном скрипте проверяется только условие <code className="text-amber-300">num_sats &gt;= 4</code>. Этого достаточно лишь для нахождения 4 неизвестных ($X, Y, Z, \Delta t$), но категорически недостаточно для обеспечения безопасности:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="bg-slate-950 p-2.5 rounded border border-rose-900/50">
                  <div className="font-bold text-rose-400 text-[11px] mb-1">4 КА: Без контроля</div>
                  <p className="text-[11px] text-slate-400">
                    При отказе или уходе часов одного спутника ошибка координат потребителя может мгновенно вырасти на километры, и приемник этого даже не заметит.
                  </p>
                </div>
                <div className="bg-slate-950 p-2.5 rounded border border-amber-900/50">
                  <div className="font-bold text-amber-400 text-[11px] mb-1">≥ 5 КА: Fault Detection (FD)</div>
                  <p className="text-[11px] text-slate-400">
                    Возникает одна избыточная псевдодальность. Приемник вычисляет невязку вектора измерений и может зафиксировать факт сбоя, предупредив пользователя.
                  </p>
                </div>
                <div className="bg-slate-950 p-2.5 rounded border border-emerald-900/50">
                  <div className="font-bold text-emerald-400 text-[11px] mb-1">≥ 6 КА: Fault Exclusion (FDE)</div>
                  <p className="text-[11px] text-slate-400">
                    Стандарт ICAO для авиации: приемник не просто фиксирует сбой, но и математически выявляет дефектный спутник, исключает его из созвездия и продолжает навигацию!
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'cost' && (
          <>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <Rocket className="w-4 h-4" />
              <span>Реалистичная экономическая модель стоимости и штрафов (CAPEX + Penalty)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/90 border border-rose-900/40 p-3 rounded-lg flex flex-col gap-2">
                <span className="font-semibold text-rose-400">Недостатки формулы студента в fitness_walker.m:</span>
                <div className="bg-slate-950 p-2 rounded font-mono text-[11px] text-slate-300">
                  cost_penalty = N * 10;<br />
                  signal_penalty = bad_epochs_total * 1000;<br />
                  penalty = signal_penalty + cost_penalty + avg_gdop;
                </div>
                <ul className="list-disc list-inside flex flex-col gap-1 text-slate-400 text-[11px]">
                  <li>Сложение разнородных размерностей (штук спутников и условных баллов штрафа).</li>
                  <li>
                    <strong>Главная ошибка:</strong> не учитывается число плоскостей $P$. Пуск 15 плоскостей требует 15 ракет! А запуск 7 плоскостей — всего 7 ракет. Стоимость пусков превышает 50–60% бюджета всей группировки!
                  </li>
                  <li>Дискретный штраф за <code className="text-rose-300">gdop &gt; 5</code> создает разрывы в целевой функции, из-за чего генетический алгоритм застревает в локальных ямах.</li>
                </ul>
              </div>

              <div className="bg-slate-900/90 border border-emerald-900/40 p-3 rounded-lg flex flex-col gap-2">
                <span className="font-semibold text-emerald-400">Реалистичная целевая функция:</span>
                <div className="bg-slate-950 p-2 rounded font-mono text-[11px] text-emerald-300">
                  Fitness = CAPEX * (1 + Σ Штрафов);<br />
                  CAPEX = P * C_launch(S) + N * C_sat(N, h) + C_ground;
                </div>
                <ul className="list-disc list-inside flex flex-col gap-1 text-slate-300 text-[11px]">
                  <li>
                    <strong>Стоимость запусков:</strong> P × C_ракеты (кластерный групповой запуск спутников в одну плоскость).
                  </li>
                  <li>
                    <strong>Кривая обучаемости (Learning Curve):</strong> при серии в N аппаратов стоимость единицы падает пропорционально N^-β (β ≈ 0.15).
                  </li>
                  <li>
                    <strong>Гладкие барьерные штрафы:</strong> квадратичный штраф за доступность (1 - Availability)², штраф за превышение PDOP &gt; 3.5, штраф за дефицит RAIM (&lt; 5 КА).
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
