import { GroundObserver, SatelliteState, WalkerConfig, DopBreakdown } from '../types';

export const WGS84 = {
  a_E: 6378137.0,              // Большая полуось Земли (м)
  f: 1 / 298.257223563,        // Сжатие
  e2: 2 * (1 / 298.257223563) - (1 / 298.257223563) ** 2, // Квадрат эксцентриситета
  mu: 3.986004418e14,          // Гравитационный параметр Земли (м^3 / с^2)
  omega_e: 7.292115e-5,        // Угловая скорость вращения Земли (рад/с)
  J2: 1.08262668e-3,           // Вторая зональная гармоника
  c: 299792458,                // Скорость света (м/с)
};

// Стандартные опорные пункты РФ (для оценки качества LEO PNT)
export const RUSSIAN_REGIONS: GroundObserver[] = [
  { id: 'msk', name: 'Москва (Центр)', latDeg: 55.75, lonDeg: 37.62, altM: 156, region: 'center', weight: 1.3 },
  { id: 'spb', name: 'Санкт-Петербург (СЗФО)', latDeg: 59.93, lonDeg: 30.33, altM: 12, region: 'center', weight: 1.1 },
  { id: 'mmk', name: 'Мурманск (СМП / Арктика)', latDeg: 68.97, lonDeg: 33.08, altM: 50, region: 'arctic', weight: 1.5 },
  { id: 'tix', name: 'Тикси (Восточная Арктика)', latDeg: 71.64, lonDeg: 128.87, altM: 35, region: 'arctic', weight: 1.5 },
  { id: 'nsk', name: 'Новосибирск (Западная Сибирь)', latDeg: 55.03, lonDeg: 82.92, altM: 150, region: 'siberia', weight: 1.2 },
  { id: 'kry', name: 'Красноярск (Восточная Сибирь)', latDeg: 56.01, lonDeg: 92.85, altM: 140, region: 'siberia', weight: 1.0 },
  { id: 'yak', name: 'Якутск (Саха)', latDeg: 62.03, lonDeg: 129.73, altM: 100, region: 'siberia', weight: 1.1 },
  { id: 'vld', name: 'Владивосток (ДФО)', latDeg: 43.12, lonDeg: 131.89, altM: 80, region: 'fareast', weight: 1.2 },
  { id: 'sch', name: 'Сочи (Юг)', latDeg: 43.60, lonDeg: 39.73, altM: 30, region: 'south', weight: 1.0 },
];

// Каноническая сетка 15 узлов из скрипта fitness_walker.m студента
export function getStudentGridNodes(): GroundObserver[] {
  const nodes: GroundObserver[] = [];
  const latRange = [45, 60, 75];
  const lonRange = [30, 60, 90, 120, 150];
  let id = 1;

  for (const lat of latRange) {
    for (const lon of lonRange) {
      nodes.push({
        id: `grid_${id}`,
        name: `Узел РФ ${id} (${lat}°N, ${lon}°E)`,
        latDeg: lat,
        lonDeg: lon,
        altM: 0,
        region: lat >= 70 ? 'arctic' : lat >= 55 ? 'siberia' : 'center',
        weight: lat >= 65 ? 1.4 : 1.0,
      });
      id++;
    }
  }
  return nodes;
}

/**
 * Расчет координат и скоростей спутников группировки Уокера в ECEF
 * с учетом J2 вековых возмущений и вращения Земли
 */
export function generateWalkerConstellation(config: WalkerConfig, t: number): SatelliteState[] {
  const { N, P, S, F, h, incDeg } = config;
  const r = WGS84.a_E + h;
  const inc = (incDeg * Math.PI) / 180;

  // Среднее движение
  const n = Math.sqrt(WGS84.mu / (r * r * r));

  // Вековая прецессия долготы восходящего узла из-за J2 (рад/с)
  const dOmega = -1.5 * WGS84.J2 * ((WGS84.a_E / r) ** 2) * n * Math.cos(inc);

  // Вековая скорость аргумента широты из-за J2 (рад/с)
  const du = n * (1 + 1.5 * WGS84.J2 * ((WGS84.a_E / r) ** 2) * (1 - 1.5 * (Math.sin(inc) ** 2)));

  const sats: SatelliteState[] = [];
  let satIndex = 1;

  for (let p = 0; p < P; p++) {
    const Omega_0 = p * (2 * Math.PI / P);
    const Omega_t = Omega_0 + (dOmega - WGS84.omega_e) * t;

    for (let s = 0; s < S; s++) {
      const u_0 = s * (2 * Math.PI / S) + p * F * (2 * Math.PI / N);
      const u_t = u_0 + du * t;

      // Координаты спутника в ECEF
      const cosOm = Math.cos(Omega_t);
      const sinOm = Math.sin(Omega_t);
      const cosU = Math.cos(u_t);
      const sinU = Math.sin(u_t);
      const cosInc = Math.cos(inc);
      const sinInc = Math.sin(inc);

      const x = r * (cosOm * cosU - sinOm * sinU * cosInc);
      const y = r * (sinOm * cosU + cosOm * sinU * cosInc);
      const z = r * (sinU * sinInc);

      // Орбитальная скорость в ECEF (аналитическая производная по t)
      const dOm_dt = dOmega - WGS84.omega_e;
      const du_dt = du;

      const vx = r * (
        -sinOm * dOm_dt * cosU - cosOm * sinU * du_dt -
        (cosOm * dOm_dt * sinU * cosInc + sinOm * cosU * du_dt * cosInc)
      );
      const vy = r * (
        cosOm * dOm_dt * cosU - sinOm * sinU * du_dt +
        (-sinOm * dOm_dt * sinU * cosInc + cosOm * cosU * du_dt * cosInc)
      );
      const vz = r * (cosU * du_dt * sinInc);

      // Географические подспутниковые координаты
      const satDist = Math.sqrt(x * x + y * y + z * z);
      const lat = (Math.asin(z / satDist) * 180) / Math.PI;
      const lon = (Math.atan2(y, x) * 180) / Math.PI;

      sats.push({
        id: satIndex++,
        planeIndex: p + 1,
        satInPlaneIndex: s + 1,
        x,
        y,
        z,
        vx,
        vy,
        vz,
        lat,
        lon,
      });
    }
  }

  return sats;
}

/**
 * Перевод геодезических координат наблюдателя (WGS84) в декартовы ECEF
 */
export function geodeticToEcef(latDeg: number, lonDeg: number, altM: number = 0): [number, number, number] {
  const phi = (latDeg * Math.PI) / 180;
  const lam = (lonDeg * Math.PI) / 180;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLam = Math.sin(lam);
  const cosLam = Math.cos(lam);

  const N_rad = WGS84.a_E / Math.sqrt(1 - WGS84.e2 * sinPhi * sinPhi);

  const X = (N_rad + altM) * cosPhi * cosLam;
  const Y = (N_rad + altM) * cosPhi * sinLam;
  const Z = (N_rad * (1 - WGS84.e2) + altM) * sinPhi;

  return [X, Y, Z];
}

/**
 * Расчет топоцентрических направляющих векторов в местной системе ENU (East-North-Up),
 * углов места, азимутов и корректных матриц DOP (GDOP, PDOP, HDOP, VDOP, TDOP)
 */
export function calculateDopEnu(
  sats: SatelliteState[],
  obsLatDeg: number,
  obsLonDeg: number,
  obsAltM: number = 0,
  maskAngleDeg: number = 10,
  carrierFreqHz: number = 1575.42e6
): DopBreakdown {
  const [ux, uy, uz] = geodeticToEcef(obsLatDeg, obsLonDeg, obsAltM);

  const phi = (obsLatDeg * Math.PI) / 180;
  const lam = (obsLonDeg * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLam = Math.sin(lam);
  const cosLam = Math.cos(lam);

  // Матрица вращения из ECEF в локальный базис ENU
  // R_enu = [-sin(lam)          cos(lam)          0     ]
  //         [-sin(phi)*cos(lam) -sin(phi)*sin(lam) cos(phi)]
  //         [ cos(phi)*cos(lam)  cos(phi)*sin(lam) sin(phi)]

  const minElevationRad = (maskAngleDeg * Math.PI) / 180;
  const visibleSats: DopBreakdown['visibleSats'] = [];
  const H_rows: number[][] = [];

  for (const sat of sats) {
    const dx = sat.x - ux;
    const dy = sat.y - uy;
    const dz = sat.z - uz;
    const R = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (R < 1000) continue;

    // Перевод вектора "наблюдатель -> спутник" в ENU
    const e = -sinLam * dx + cosLam * dy;
    const n = -sinPhi * cosLam * dx - sinPhi * sinLam * dy + cosPhi * dz;
    const u = cosPhi * cosLam * dx + cosPhi * sinLam * dy + sinPhi * dz;

    const elevation = Math.asin(Math.max(-1, Math.min(1, u / R)));
    let azimuth = Math.atan2(e, n);
    if (azimuth < 0) azimuth += 2 * Math.PI;

    if (elevation >= minElevationRad) {
      // Направляющие косинусы в системе ENU
      const lx = e / R;
      const ly = n / R;
      const lz = u / R;

      // Строка навигационной матрицы H: [lx, ly, lz, 1]
      H_rows.push([lx, ly, lz, 1]);

      // Относительная скорость (потребитель стационарен на Земле, учитываем вращение Земли)
      // Вращательная скорость точки на поверхности Земли
      const v_user_x = -WGS84.omega_e * uy;
      const v_user_y = WGS84.omega_e * ux;
      const v_user_z = 0;

      const dvx = sat.vx - v_user_x;
      const dvy = sat.vy - v_user_y;
      const dvz = sat.vz - v_user_z;

      // Проекция скорости на луч визирования (Line of Sight)
      const radialVelocity = (dx * dvx + dy * dvy + dz * dvz) / R;
      const dopplerHz = -(carrierFreqHz / WGS84.c) * radialVelocity;

      // Free Space Path Loss (дБ)
      const fsplDb = 20 * Math.log10(R) + 20 * Math.log10(carrierFreqHz) - 147.55;

      visibleSats.push({
        id: sat.id,
        elevationDeg: (elevation * 180) / Math.PI,
        azimuthDeg: (azimuth * 180) / Math.PI,
        rangeKm: R / 1000,
        dopplerKhz: dopplerHz / 1000,
        fsplDb,
      });
    }
  }

  const numSats = visibleSats.length;

  if (numSats < 4) {
    return {
      numSats,
      gdop: 999,
      pdop: 999,
      hdop: 999,
      vdop: 999,
      tdop: 999,
      isDegenerate: true,
      visibleSats,
    };
  }

  // Вычисление матрицы Normal Equations: M = H^T * H (размер 4x4)
  const M: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];

  for (let r = 0; r < H_rows.length; r++) {
    const row = H_rows[r];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        M[i][j] += row[i] * row[j];
      }
    }
  }

  // Обращение матрицы 4x4 методом Гаусса-Жордана
  const Q = invert4x4(M);

  if (!Q) {
    return {
      numSats,
      gdop: 999,
      pdop: 999,
      hdop: 999,
      vdop: 999,
      tdop: 999,
      isDegenerate: true,
      visibleSats,
    };
  }

  // Диагональные элементы ковариационной матрицы Q в ENU:
  // Q[0][0] = q_East, Q[1][1] = q_North, Q[2][2] = q_Up, Q[3][3] = q_Time
  const qE = Math.max(0, Q[0][0]);
  const qN = Math.max(0, Q[1][1]);
  const qU = Math.max(0, Q[2][2]);
  const qT = Math.max(0, Q[3][3]);

  const hdop = Math.sqrt(qE + qN);
  const vdop = Math.sqrt(qU);
  const pdop = Math.sqrt(qE + qN + qU);
  const tdop = Math.sqrt(qT);
  const gdop = Math.sqrt(qE + qN + qU + qT);

  return {
    numSats,
    gdop: isNaN(gdop) ? 999 : Math.min(999, gdop),
    pdop: isNaN(pdop) ? 999 : Math.min(999, pdop),
    hdop: isNaN(hdop) ? 999 : Math.min(999, hdop),
    vdop: isNaN(vdop) ? 999 : Math.min(999, vdop),
    tdop: isNaN(tdop) ? 999 : Math.min(999, tdop),
    isDegenerate: gdop > 100 || isNaN(gdop),
    visibleSats,
  };
}

/**
 * Инверсия матрицы 4x4
 */
function invert4x4(matrix: number[][]): number[][] | null {
  const m = matrix.map((row) => [...row]);
  const inv: number[][] = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];

  for (let i = 0; i < 4; i++) {
    // Выбор ведущего элемента
    let pivot = i;
    for (let j = i + 1; j < 4; j++) {
      if (Math.abs(m[j][i]) > Math.abs(m[pivot][i])) {
        pivot = j;
      }
    }

    if (Math.abs(m[pivot][i]) < 1e-12) {
      return null; // Вырожденная матрица (ill-conditioned)
    }

    if (pivot !== i) {
      const tempM = m[i];
      m[i] = m[pivot];
      m[pivot] = tempM;

      const tempInv = inv[i];
      inv[i] = inv[pivot];
      inv[pivot] = tempInv;
    }

    const div = m[i][i];
    for (let j = 0; j < 4; j++) {
      m[i][j] /= div;
      inv[i][j] /= div;
    }

    for (let j = 0; j < 4; j++) {
      if (j !== i) {
        const mult = m[j][i];
        for (let k = 0; k < 4; k++) {
          m[j][k] -= mult * m[i][k];
          inv[j][k] -= mult * inv[i][k];
        }
      }
    }
  }

  return inv;
}

/**
 * Оценка плотности атмосферы и срока службы на орбите без коррекций
 */
export function getAtmosphereAndRadiationProfile(hMeters: number) {
  const hKm = hMeters / 1000;

  // Плотность верхней атмосферы (экспоненциальная аппроксимация модели ГОСТ / Jacchia)
  // rho (кг/м^3)
  let densityKgM3 = 0;
  if (hKm < 500) {
    densityKgM3 = 1e-11 * Math.exp(-(hKm - 400) / 50);
  } else if (hKm < 800) {
    densityKgM3 = 1e-12 * Math.exp(-(hKm - 500) / 70);
  } else {
    densityKgM3 = 1e-14 * Math.exp(-(hKm - 800) / 100);
  }

  // Оценка баллистического срока службы без дозаправки (лет)
  let ballisticLifespanYears = 0;
  if (hKm < 500) ballisticLifespanYears = 2.5 + (hKm - 400) * 0.03;
  else if (hKm < 700) ballisticLifespanYears = 5 + (hKm - 500) * 0.06;
  else if (hKm < 1000) ballisticLifespanYears = 15 + (hKm - 700) * 0.1;
  else ballisticLifespanYears = 50 + (hKm - 1000) * 0.2;

  // Радиационный фон (внутренний радиационный пояс Ван Аллена протонов начинается от ~1100 км, пик ~3000 км)
  let inRadiationBelt = false;
  let radiationDoseKradPerYear = 1.0; // Фоновая доза на LEO ~ 1-3 крад/год
  let radHardRequired = false;

  if (hKm > 1100) {
    inRadiationBelt = true;
    radHardRequired = true;
    // Резкий экспоненциальный рост дозы радиации
    radiationDoseKradPerYear = 2.0 + Math.pow((hKm - 1100) / 100, 2) * 8;
  }

  return {
    hKm,
    densityKgM3,
    ballisticLifespanYears: Math.min(100, Math.round(ballisticLifespanYears * 10) / 10),
    inRadiationBelt,
    radHardRequired,
    radiationDoseKradPerYear: Math.round(radiationDoseKradPerYear * 10) / 10,
  };
}
