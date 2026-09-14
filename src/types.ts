/**
 * Types for LEO PNT Constellation Optimizer & Scientific Analysis
 * НИУ «МЭИ», Кафедра РЭКС, Специальность 11.05.01
 */

export interface WalkerConfig {
  N: number;        // Всего спутников (P * S)
  P: number;        // Число орбитальных плоскостей
  S: number;        // Число спутников в плоскости
  F: number;        // Фазовый параметр Уокера (0 .. P-1)
  h: number;        // Высота круговой орбиты в метрах (например 1493000)
  incDeg: number;   // Наклонение орбиты в градусах (например 71.0)
  maskAngleDeg: number; // Угол маски места (например 10)
}

export interface SatelliteState {
  id: number;
  planeIndex: number;
  satInPlaneIndex: number;
  x: number; // ECEF X (м)
  y: number; // ECEF Y (м)
  z: number; // ECEF Z (м)
  vx: number; // ECEF Vx (м/с)
  vy: number; // ECEF Vy (м/с)
  vz: number; // ECEF Vz (м/с)
  lat: number; // Подспутниковая широта (град)
  lon: number; // Подспутниковая долгота (град)
}

export interface GroundObserver {
  id: string;
  name: string;
  latDeg: number;
  lonDeg: number;
  altM: number;
  region: 'center' | 'arctic' | 'siberia' | 'fareast' | 'south';
  weight: number; // Весовой коэффициент региона для фитнес-функции
}

export interface DopBreakdown {
  numSats: number;
  gdop: number;
  pdop: number;
  hdop: number;
  vdop: number;
  tdop: number;
  isDegenerate: boolean;
  visibleSats: Array<{
    id: number;
    elevationDeg: number;
    azimuthDeg: number;
    rangeKm: number;
    dopplerKhz: number;
    fsplDb: number;
  }>;
}

export interface RealisticCostBreakdown {
  launchCount: number;         // Количество пусков = P
  costPerLaunchM: number;      // Стоимость 1 пуска (млн руб)
  totalLaunchCostM: number;    // Общая стоимость запусков (млн руб)
  baseSatCostM: number;        // Базовая стоимость спутника (млн руб)
  radHardSurchargeM: number;   // Доплата за радиационную стойкость (при h > 1100 км)
  unitSatCostM: number;        // Финальная стоимость 1 аппарата с учетом серии
  totalSatellitesCostM: number;// Общая стоимость аппаратов с кривой обучения (млн руб)
  groundSegmentCostM: number;  // Наземный комплекс управления и закладки эфемерид
  totalCapexM: number;         // Итоговый CAPEX (млн руб)
  
  // Штрафные составляющие фитнес-функции
  availabilityPct: number;     // Процент времени/узлов с PDOP <= 4.0 (%)
  outagePenalty: number;       // Штраф за потерю доступности
  dopPenalty: number;          // Штраф за средний/максимальный PDOP
  raimPenalty: number;         // Штраф за несоблюдение условия RAIM (видимых < 5)
  radiationRiskPenalty: number;// Штраф за попадание в радиационный пояс
  dragLifespanPenalty: number; // Штраф за низкие орбиты с сильным торможением (h < 600 км)
  totalFitness: number;        // Итоговое значение фитнес-функции (минимизируется)
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  modelUsed?: string;
  hasThinking?: boolean;
}

export type ConsultantRole = 'supervisor' | 'ballistics' | 'avionics' | 'economist';

export type AdvisorRole = ConsultantRole;

export interface AdvisorMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
