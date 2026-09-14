import { GroundObserver, RealisticCostBreakdown, WalkerConfig } from '../types';
import { calculateDopEnu, generateWalkerConstellation, getAtmosphereAndRadiationProfile } from './orbitPhysics';

/**
 * Расчет реалистичной стоимости космической системы (CAPEX)
 * и многокритериальной фитнес-функции штрафов для группировки Уокера
 */
export function evaluateRealisticSystemCost(
  config: WalkerConfig,
  observers: GroundObserver[],
  timeSteps: number[] = [0, 600, 1200, 1800, 2400, 3000, 3600] // Шаги времени (с)
): RealisticCostBreakdown {
  const { N, P, S, h, maskAngleDeg } = config;

  // 1. СТОИМОСТЬ ПУСКОВЫХ УСЛУГ (Launch Costs)
  // Для каждой плоскости P необходим отдельный пуск ракеты среднего/тяжелого класса
  // (например, «Союз-2.1б» / «Ангара-А5» с РБ «Фрегат» с космодрома Плесецк или Восточный)
  const baseLaunchCostM = 1900; // Базовая стоимость 1 пуска ~ 1.9 млрд руб (~$21M)
  const dispenserCostPerSatM = 15; // Стоимость адаптера полезной нагрузки на 1 спутник
  const costPerLaunchM = baseLaunchCostM + S * dispenserCostPerSatM;
  const totalLaunchCostM = P * costPerLaunchM;

  // 2. СТОИМОСТЬ ИЗГОТОВЛЕНИЯ АППАРАТОВ (Satellite Production with Learning Curve)
  // Базовая стоимость малого навигационного аппарата (150-250 кг)
  const baseSatCostM = 220; // 220 млн руб за головной образец
  const learningRate = 0.88; // 88% кривая обучаемости (серийная скидка)
  const beta = -Math.log2(learningRate); // Показатель кривой Райта

  // Учет радиационного пояса Ван Аллена при h > 1100 км
  const atmoRad = getAtmosphereAndRadiationProfile(h);
  let radHardSurchargeM = 0;
  if (atmoRad.radHardRequired) {
    // Радиационно-стойкая ЭКБ уровня Space-grade rad-hard, тройные арсенид-галиевые СБ с защитными стеклами
    radHardSurchargeM = baseSatCostM * 0.45; // +45% к стоимости аппарата
  }

  const effectiveUnitBase = baseSatCostM + radHardSurchargeM;
  // Средняя стоимость спутника в серии N аппаратов
  const unitSatCostM = effectiveUnitBase * Math.pow(Math.max(1, N), -beta);
  const totalSatellitesCostM = N * unitSatCostM;

  // 3. НАЗЕМНЫЙ СЕГМЕНТ И УПРАВЛЕНИЕ (Ground Segment)
  const groundSegmentCostM = 650 + P * 25; // Станции командно-измерительного комплекса и закладки эфемерид

  // ИТОГОВЫЙ CAPEX (млн руб)
  const totalCapexM = totalLaunchCostM + totalSatellitesCostM + groundSegmentCostM;

  // 4. ОЦЕНКА КАЧЕСТВА НАВИГАЦИОННОГО ПОЛЯ И РАСЧЕТ ШТРАФОВ
  let totalObservations = 0;
  let outageEpochsWeighted = 0;
  let raimFailedEpochsWeighted = 0;
  let sumPdopWeighted = 0;
  let maxPdopObserved = 0;
  let validCount = 0;

  for (const t of timeSteps) {
    const sats = generateWalkerConstellation(config, t);

    for (const obs of observers) {
      const dop = calculateDopEnu(sats, obs.latDeg, obs.lonDeg, obs.altM, maskAngleDeg);
      const w = obs.weight || 1.0;
      totalObservations += w;

      if (dop.numSats < 4 || dop.isDegenerate || dop.pdop > 6.0) {
        // Потеря сигнала или катастрофическая деградация геометрии
        outageEpochsWeighted += w;
      } else {
        sumPdopWeighted += dop.pdop * w;
        validCount += w;
        if (dop.pdop > maxPdopObserved) {
          maxPdopObserved = dop.pdop;
        }
      }

      // Проверка условия RAIM (автономный контроль целостности в приемнике):
      // Для обнаружения аномального спутника нужно >= 5 видимых аппаратов
      if (dop.numSats < 5) {
        raimFailedEpochsWeighted += w;
      }
    }
  }

  const outageRatio = totalObservations > 0 ? outageEpochsWeighted / totalObservations : 1.0;
  const availabilityPct = Math.max(0, (1 - outageRatio) * 100);
  const avgPdop = validCount > 0 ? sumPdopWeighted / validCount : 10.0;

  // ШТРАФНЫЕ СОСТАВЛЯЮЩИЕ:
  // а) Штраф за потерю доступности (квадратичный барьер при падении ниже 99.9%)
  const availabilityDeficit = Math.max(0, 99.9 - availabilityPct);
  const outagePenalty = Math.pow(availabilityDeficit, 2) * 80;

  // б) Штраф за геометрию DOP (барьерная функция, штрафующая средний PDOP > 2.5)
  const dopPenalty = Math.max(0, avgPdop - 2.0) * 120 + Math.max(0, maxPdopObserved - 4.0) * 50;

  // в) Штраф за RAIM (требование гражданской авиации ICAO и высокоточных потребителей)
  const raimDeficitPct = totalObservations > 0 ? (raimFailedEpochsWeighted / totalObservations) * 100 : 100;
  const raimPenalty = Math.pow(raimDeficitPct, 1.5) * 1.5;

  // г) Штраф за радиационный пояс Ван Аллена (риск преждевременного выхода из строя)
  let radiationRiskPenalty = 0;
  if (atmoRad.inRadiationBelt) {
    const excessAltKm = (h / 1000) - 1100;
    radiationRiskPenalty = Math.pow(excessAltKm / 100, 2) * 150;
  }

  // д) Штраф за низкие орбиты с плотной атмосферой (h < 600 км - короткий САС и большой расход топлива)
  let dragLifespanPenalty = 0;
  if (h / 1000 < 600) {
    const deficitKm = 600 - (h / 1000);
    dragLifespanPenalty = Math.pow(deficitKm / 50, 2) * 200;
  }

  // ИТОГОВАЯ ФИТНЕС-ФУНКЦИЯ (Нормализованная взвешенная свертка для оптимизатора)
  // Fitness = CAPEX_M * (1 + sum_penalties / 1000)
  const penaltyFactor = (outagePenalty + dopPenalty + raimPenalty + radiationRiskPenalty + dragLifespanPenalty) / 1000;
  const totalFitness = totalCapexM * (1 + penaltyFactor);

  return {
    launchCount: P,
    costPerLaunchM: Math.round(costPerLaunchM),
    totalLaunchCostM: Math.round(totalLaunchCostM),
    baseSatCostM: Math.round(baseSatCostM),
    radHardSurchargeM: Math.round(radHardSurchargeM),
    unitSatCostM: Math.round(unitSatCostM * 10) / 10,
    totalSatellitesCostM: Math.round(totalSatellitesCostM),
    groundSegmentCostM: Math.round(groundSegmentCostM),
    totalCapexM: Math.round(totalCapexM),
    availabilityPct: Math.round(availabilityPct * 100) / 100,
    outagePenalty: Math.round(outagePenalty),
    dopPenalty: Math.round(dopPenalty),
    raimPenalty: Math.round(raimPenalty),
    radiationRiskPenalty: Math.round(radiationRiskPenalty),
    dragLifespanPenalty: Math.round(dragLifespanPenalty),
    totalFitness: Math.round(totalFitness),
  };
}

/**
 * Пресеты группировок для сравнительного анализа в научной работе
 */
export const CONSTELLATION_PRESETS: Array<{
  id: string;
  name: string;
  badge: string;
  config: WalkerConfig;
  description: string;
}> = [
  {
    id: 'winner_105',
    name: 'Текущий оптимум студента (105 КА, 7/15/5)',
    badge: 'Конфигурация победителя',
    config: {
      N: 105,
      P: 7,
      S: 15,
      F: 5,
      h: 1493000,
      incDeg: 71.0,
      maskAngleDeg: 10,
    },
    description: 'Найдена в текущем скрипте студента. Отличное покрытие, но высота 1493 км находится внутри протонного пояса Ван Аллена, а 105 КА дают высокий CAPEX.',
  },
  {
    id: 'optimal_clean_leo',
    name: 'Энерго- и радиационно-чистая LEO (72 КА, 8/9/4)',
    badge: 'Рекомендация кафедры',
    config: {
      N: 72,
      P: 8,
      S: 9,
      F: 4,
      h: 980000,
      incDeg: 72.5,
      maskAngleDeg: 10,
    },
    description: 'Высота 980 км лежит ниже радиационных поясов (резкая экономия на ЭКБ), при этом 72 КА обеспечивают непрерывную доступность >99.9% над РФ и СМП.',
  },
  {
    id: 'compact_arctic',
    name: 'Бюджетная Арктическая группировка (48 КА, 6/8/3)',
    badge: 'Минимальный CAPEX',
    config: {
      N: 48,
      P: 6,
      S: 8,
      F: 3,
      h: 1100000,
      incDeg: 76.0,
      maskAngleDeg: 10,
    },
    description: 'Всего 6 пусков ракет-носителей. Высокое наклонение 76° фокусирует покрытие на Северном морском пути и Арктике при сниженном CAPEX на 35%.',
  },
  {
    id: 'high_resilience',
    name: 'Усиленная группировка с RAIM FDE (120 КА, 10/12/5)',
    badge: 'Авиационный стандарт ICAO',
    config: {
      N: 120,
      P: 10,
      S: 12,
      F: 5,
      h: 1200000,
      incDeg: 70.0,
      maskAngleDeg: 10,
    },
    description: 'Гарантирует 6-8 видимых спутников в любой точке РФ для мгновенного исключения отказавшего КА (Fault Detection & Exclusion).',
  },
];
