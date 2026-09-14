import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GroundObserver, SatelliteState, WalkerConfig, DopBreakdown } from '../types';
import { geodeticToEcef, WGS84 } from '../lib/orbitPhysics';
import { Eye, RotateCw, Play, Pause, ZoomIn, ZoomOut, Layers, Compass } from 'lucide-react';

interface ThreeGlobeProps {
  config: WalkerConfig;
  sats: SatelliteState[];
  selectedObserver: GroundObserver;
  dopInfo: DopBreakdown;
  simTimeSeconds: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onTimeChange: (t: number) => void;
}

export const ThreeGlobe: React.FC<ThreeGlobeProps> = ({
  config,
  sats,
  selectedObserver,
  dopInfo,
  simTimeSeconds,
  isPlaying,
  onTogglePlay,
  onTimeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Scene object groups
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const orbitsGroupRef = useRef<THREE.Group | null>(null);
  const satellitesGroupRef = useRef<THREE.Group | null>(null);
  const losLinesGroupRef = useRef<THREE.Group | null>(null);
  const observerMeshRef = useRef<THREE.Mesh | null>(null);

  const [showOrbits, setShowOrbits] = useState(true);
  const [showFootprints, setShowFootprints] = useState(true);
  const [showLosBeams, setShowLosBeams] = useState(true);

  // Camera interaction state
  const isDraggingRef = useRef(false);
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef({ theta: 0.8, phi: 0.5, radius: 4.5 });

  // Scale: Earth radius R_E = 1.0 units in 3D
  const SCALE = 1.0 / WGS84.a_E;
  const earthRadius3D = 1.0;
  const satRadius3D = (WGS84.a_E + config.h) * SCALE;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 500;

    // 1. SCENE
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a0f1d);

    // 2. CAMERA
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // 5. EARTH GROUP
    const earthGroup = new THREE.Group();
    earthGroupRef.current = earthGroup;
    scene.add(earthGroup);

    // Earth Sphere
    const earthGeo = new THREE.SphereGeometry(earthRadius3D, 64, 64);
    // Procedural canvas texture for Earth continents & oceans
    const earthTexture = createProceduralEarthTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.8,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Atmosphere Glow
    const atmoGeo = new THREE.SphereGeometry(earthRadius3D * 1.015, 64, 64);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
    });
    earthGroup.add(new THREE.Mesh(atmoGeo, atmoMat));

    // Lat/Lon Wireframe Grid
    const gridGeo = new THREE.SphereGeometry(earthRadius3D * 1.002, 36, 18);
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    earthGroup.add(new THREE.Mesh(gridGeo, gridMat));

    // Equator Ring
    const equatorGeo = new THREE.RingGeometry(earthRadius3D * 1.003, earthRadius3D * 1.006, 64);
    const equatorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const equator = new THREE.Mesh(equatorGeo, equatorMat);
    equator.rotation.x = Math.PI / 2;
    earthGroup.add(equator);

    // Observer Marker on Earth
    const obsGeo = new THREE.ConeGeometry(0.025, 0.07, 16);
    obsGeo.rotateX(Math.PI / 2);
    const obsMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const obsMesh = new THREE.Mesh(obsGeo, obsMat);
    observerMeshRef.current = obsMesh;
    earthGroup.add(obsMesh);

    // 6. ORBITAL PLANES GROUP
    const orbitsGroup = new THREE.Group();
    orbitsGroupRef.current = orbitsGroup;
    scene.add(orbitsGroup);

    // 7. SATELLITES GROUP
    const satellitesGroup = new THREE.Group();
    satellitesGroupRef.current = satellitesGroup;
    scene.add(satellitesGroup);

    // 8. LINE-OF-SIGHT BEAMS GROUP
    const losLinesGroup = new THREE.Group();
    losLinesGroupRef.current = losLinesGroup;
    scene.add(losLinesGroup);

    // MOUSE / TOUCH EVENTS
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - prevMouseRef.current.x;
      const dy = e.clientY - prevMouseRef.current.y;
      prevMouseRef.current = { x: e.clientX, y: e.clientY };

      cameraAngleRef.current.theta -= dx * 0.008;
      cameraAngleRef.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraAngleRef.current.phi - dy * 0.008));
      updateCameraPosition();
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraAngleRef.current.radius = Math.max(1.8, Math.min(10.0, cameraAngleRef.current.radius + e.deltaY * 0.003));
      updateCameraPosition();
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // RESIZE OBSERVER
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 500;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    });
    resizeObserver.observe(container);

    // ANIMATION LOOP
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      renderer.dispose();
    };
  }, []);

  function updateCameraPosition() {
    if (!cameraRef.current) return;
    const { theta, phi, radius } = cameraAngleRef.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(0, 0, 0);
  }

  // Update Earth rotation & observer pin
  useEffect(() => {
    if (!earthGroupRef.current || !observerMeshRef.current) return;

    // Observer position in ECEF scaled
    const [ux, uy, uz] = geodeticToEcef(selectedObserver.latDeg, selectedObserver.lonDeg, selectedObserver.altM);
    const obsPos3D = new THREE.Vector3(ux * SCALE, uz * SCALE, -uy * SCALE); // Note coordinates map: Y-up in Three.js
    observerMeshRef.current.position.copy(obsPos3D);
    observerMeshRef.current.lookAt(obsPos3D.clone().multiplyScalar(1.5));
  }, [selectedObserver]);

  // Update Orbital Rings
  useEffect(() => {
    if (!orbitsGroupRef.current) return;
    const group = orbitsGroupRef.current;
    group.clear();

    if (!showOrbits) return;

    const { P, incDeg } = config;
    const incRad = (incDeg * Math.PI) / 180;
    const segments = 120;

    for (let p = 0; p < P; p++) {
      const Omega_0 = p * (2 * Math.PI / P);
      const points: THREE.Vector3[] = [];

      for (let i = 0; i <= segments; i++) {
        const u = (i / segments) * 2 * Math.PI;
        // In inertial coordinates:
        const x = satRadius3D * (Math.cos(Omega_0) * Math.cos(u) - Math.sin(Omega_0) * Math.sin(u) * Math.cos(incRad));
        const y = satRadius3D * (Math.sin(Omega_0) * Math.cos(u) + Math.cos(Omega_0) * Math.sin(u) * Math.cos(incRad));
        const z = satRadius3D * (Math.sin(u) * Math.sin(incRad));

        // Three.js coord mapping: X -> X, Z -> Y, Y -> -Z
        points.push(new THREE.Vector3(x, z, -y));
      }

      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.35,
      });
      group.add(new THREE.Line(lineGeo, lineMat));
    }
  }, [config, showOrbits, satRadius3D]);

  // Update Satellites & LOS Beams
  useEffect(() => {
    if (!satellitesGroupRef.current || !losLinesGroupRef.current) return;
    const satGroup = satellitesGroupRef.current;
    const losGroup = losLinesGroupRef.current;

    satGroup.clear();
    losGroup.clear();

    const [ux, uy, uz] = geodeticToEcef(selectedObserver.latDeg, selectedObserver.lonDeg, selectedObserver.altM);
    const obsPos3D = new THREE.Vector3(ux * SCALE, uz * SCALE, -uy * SCALE);

    const visibleIds = new Set(dopInfo.visibleSats.map((v) => v.id));

    // Satellite Geometry
    const defaultSatGeo = new THREE.SphereGeometry(0.022, 12, 12);
    const visibleSatGeo = new THREE.SphereGeometry(0.035, 16, 16);

    const defaultSatMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const visibleSatMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

    for (const sat of sats) {
      const isVisible = visibleIds.has(sat.id);
      const satPos3D = new THREE.Vector3(sat.x * SCALE, sat.z * SCALE, -sat.y * SCALE);

      const mesh = new THREE.Mesh(isVisible ? visibleSatGeo : defaultSatGeo, isVisible ? visibleSatMat : defaultSatMat);
      mesh.position.copy(satPos3D);
      satGroup.add(mesh);

      // Visibility footprint cone / circle on Earth
      if (showFootprints && isVisible) {
        // Line-of-sight beam to observer
        if (showLosBeams) {
          const linePoints = [obsPos3D, satPos3D];
          const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0x22c55e,
            transparent: true,
            opacity: 0.8,
            linewidth: 2,
          });
          losGroup.add(new THREE.Line(lineGeo, lineMat));
        }
      }
    }
  }, [sats, dopInfo, selectedObserver, showFootprints, showLosBeams]);

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 shadow-xl">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top HUD: Constellation status */}
      <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700/80 text-xs text-slate-200 flex flex-col gap-1 pointer-events-none shadow-md">
        <div className="flex items-center gap-2 font-semibold text-white">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Walker {config.N}/{config.P}/{config.F} (h = {(config.h / 1000).toFixed(0)} км, i = {config.incDeg.toFixed(1)}°)
        </div>
        <div className="text-slate-400">
          Пункт наблюдения: <span className="text-amber-300 font-medium">{selectedObserver.name}</span>
        </div>
        <div className="flex items-center gap-3 pt-1 border-t border-slate-800 text-[11px]">
          <div>
            Видимых КА: <span className="font-bold text-emerald-400">{dopInfo.numSats}</span>
          </div>
          <div>
            PDOP: <span className={`font-bold ${dopInfo.pdop <= 3.0 ? 'text-emerald-400' : dopInfo.pdop <= 5 ? 'text-amber-400' : 'text-rose-400'}`}>
              {dopInfo.pdop < 900 ? dopInfo.pdop.toFixed(2) : '—'}
            </span>
          </div>
          <div>
            HDOP: <span className="font-bold text-sky-400">{dopInfo.hdop < 900 ? dopInfo.hdop.toFixed(2) : '—'}</span>
          </div>
          <div>
            VDOP: <span className="font-bold text-purple-400">{dopInfo.vdop < 900 ? dopInfo.vdop.toFixed(2) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Top Right: Layer toggles */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-lg border border-slate-700/80 text-xs text-slate-300">
        <button
          id="btn-toggle-orbits"
          onClick={() => setShowOrbits(!showOrbits)}
          className={`px-2 py-1 rounded transition-colors ${showOrbits ? 'bg-blue-600/80 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          title="Отображать орбитальные кольца"
        >
          Плоскости P ({config.P})
        </button>
        <button
          id="btn-toggle-beams"
          onClick={() => setShowLosBeams(!showLosBeams)}
          className={`px-2 py-1 rounded transition-colors ${showLosBeams ? 'bg-emerald-600/80 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          title="Отображать лучи радиовидимости LOS"
        >
          Лучи визирования ({dopInfo.visibleSats.length})
        </button>
      </div>

      {/* Bottom Controls: Time & Playback */}
      <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-lg border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            id="btn-play-pause-3d"
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-medium rounded-md shadow transition"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Пауза' : 'Пуск'}</span>
          </button>
          <button
            id="btn-reset-time"
            onClick={() => onTimeChange(0)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md transition"
            title="Сбросить время в 0"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-slate-300 min-w-[70px]">
            t = {Math.floor(simTimeSeconds / 60)}м {simTimeSeconds % 60}с
          </span>
        </div>

        {/* Time slider */}
        <div className="flex-1 min-w-[160px] max-w-md flex items-center gap-2">
          <span className="text-[11px] text-slate-400">0ч</span>
          <input
            id="slider-orbit-time"
            type="range"
            min={0}
            max={7200}
            step={30}
            value={simTimeSeconds}
            onChange={(e) => onTimeChange(Number(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
          />
          <span className="text-[11px] text-slate-400">2ч</span>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Видимый спутник</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Вне видимости</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500" /> Наблюдатель</span>
        </div>
      </div>
    </div>
  );
};

// Procedural Canvas Texture for realistic Earth continents, oceans & grids
function createProceduralEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
  oceanGrad.addColorStop(0, '#0f172a');
  oceanGrad.addColorStop(0.5, '#0c2340');
  oceanGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Draw land masses (Eurasia, Africa, Americas, Australia, Antarctica simplified)
  ctx.fillStyle = '#1e3a5f';

  // Eurasia & Russia
  ctx.beginPath();
  // Simple polygon representing Eurasia & Russia
  ctx.moveTo(480, 100);
  ctx.lineTo(820, 90);
  ctx.lineTo(850, 140);
  ctx.lineTo(800, 240);
  ctx.lineTo(650, 260);
  ctx.lineTo(580, 240);
  ctx.lineTo(520, 200);
  ctx.lineTo(470, 180);
  ctx.closePath();
  ctx.fill();

  // Highlight Russian Federation Territory
  ctx.fillStyle = '#2b4c7e';
  ctx.beginPath();
  ctx.moveTo(530, 90);
  ctx.lineTo(850, 80);
  ctx.lineTo(890, 130);
  ctx.lineTo(760, 170);
  ctx.lineTo(600, 160);
  ctx.lineTo(540, 140);
  ctx.closePath();
  ctx.fill();

  // Africa
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.moveTo(480, 210);
  ctx.lineTo(580, 230);
  ctx.lineTo(540, 360);
  ctx.lineTo(500, 380);
  ctx.lineTo(470, 280);
  ctx.closePath();
  ctx.fill();

  // North America
  ctx.beginPath();
  ctx.moveTo(120, 80);
  ctx.lineTo(320, 90);
  ctx.lineTo(260, 220);
  ctx.lineTo(190, 240);
  ctx.lineTo(140, 180);
  ctx.closePath();
  ctx.fill();

  // South America
  ctx.beginPath();
  ctx.moveTo(230, 250);
  ctx.lineTo(310, 290);
  ctx.lineTo(260, 420);
  ctx.lineTo(220, 350);
  ctx.closePath();
  ctx.fill();

  // Australia
  ctx.beginPath();
  ctx.arc(780, 340, 40, 0, Math.PI * 2);
  ctx.fill();

  // Antarctica
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 470, 1024, 42);

  // Subtle grid lines (every 30 degrees)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 1024; x += 1024 / 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 512 / 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Equator line
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 256);
  ctx.lineTo(1024, 256);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}
