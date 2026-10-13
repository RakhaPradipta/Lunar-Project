/**
 * Robot3D — maskot robot 3D interaktif untuk WisataBot.
 *
 * Render: three.js via @react-three/fiber. Komponen ini di-lazy-load dari
 * AiChatWidget sehingga bundle three.js masuk chunk terpisah dan tidak
 * membebani muat awal halaman. Bila WebGL tidak tersedia (browser lama /
 * GPU diblokir), otomatis fallback ke ikon Bot biasa.
 *
 * Tampilan: badan hijau senada tema desa wisata, mata & mulut biru menyala,
 * dan topi jerami wisatawan 🌾 (antena tetap menembus puncak topi).
 *
 * Interaksi:
 *  - Mengikuti kursor global: kepala menoleh ke arah kursor di mana pun
 *    ia bergerak di halaman (listener window, bukan hanya saat hover canvas).
 *  - Bola mata ikut bergeser ke arah kursor — lebih responsif dari kepala,
 *    jadi mata "melirik dulu" lalu kepala menyusul (gerak alami).
 *  - Idle: melayang halus + goyang kecil, mata berkedip acak (3–5 dtk).
 *  - `speaking` (sinkron status TTS): mulut beranimasi, antena berdenyut.
 *  - `wave`: lengan kanan melambaikan (dipicu saat jendela chat dibuka).
 *  - Klik robot: reaksi berputar 360° + lompat kecil.
 *  - Menghormati prefers-reduced-motion (animasi diredam).
 */

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { Bot } from 'lucide-react';

interface RobotSceneProps {
  speaking: boolean;
  interactive: boolean;
  reducedMotion: boolean;
  wave: boolean;
}

/** Palet warna robot: hijau desa wisata + wajah biru menyala + topi jerami. */
const C = {
  body: '#16a34a', // badan utama (hijau)
  bodyDark: '#15803d', // bagian badan lebih gelap
  accent: '#22c55e', // aksen / pod telinga / pita topi
  light: '#dcfce7', // bagian terang (leher)
  eye: '#7dd3fc', // iris mata biru terang
  eyeGlow: '#38bdf8', // emis mata & mulut
  straw: '#e3b76a', // jerami topi
  strawDark: '#c99a4b', // bayangan jerami
  indicator: '#fbbf24', // lampu dada (amber)
};

function RobotScene({ speaking, interactive, reducedMotion, wave }: RobotSceneProps) {
  const root = useRef<THREE.Group>(null); // float + reaksi klik
  const head = useRef<THREE.Group>(null); // ikut kursor
  const eyeL = useRef<THREE.Mesh>(null);
  const eyeR = useRef<THREE.Mesh>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const antennaTip = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Group>(null); // lengan kanan (melambaikan)

  const nextBlink = useRef(2); // waktu kedip berikutnya (detik)
  const blinkT = useRef(-1); // progress kedip 0..1; -1 = tidak sedang kedip
  const spinT = useRef(-1); // progress reaksi klik 0..1; -1 = idle
  const talkPhase = useRef(0);
  const waveT = useRef(-1); // progress lambaikan 0..1; -1 = idle
  const prevWave = useRef(false);

  // Posisi kursor global dinormalisasi ke -1..1 (x: kiri→kanan, y: atas→bawah).
  const pointer = useRef({ x: 0, y: 0 });

  // Lacak kursor di SELURUH halaman — bukan hanya saat kursor di atas canvas
  // (state.pointer bawaan R3F hanya ter-update saat hover di canvas).
  useEffect(() => {
    if (!interactive) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [interactive]);

  // Picu animasi lambaikan saat `wave` berubah false → true.
  useEffect(() => {
    if (wave && !prevWave.current && !reducedMotion) waveT.current = 0;
    prevWave.current = wave;
  }, [wave, reducedMotion]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // — Melayang idle + reaksi klik (putar & lompat) —
    const r = root.current;
    if (r) {
      const amp = reducedMotion ? 0 : Math.sin(t * 1.3) * 0.06;
      let jump = 0;
      let spinExtra = 0;
      if (spinT.current >= 0) {
        spinT.current += dt / 0.7; // durasi reaksi 0.7 detik
        const p = spinT.current;
        if (p >= 1) spinT.current = -1;
        else {
          const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
          spinExtra = e * Math.PI * 2;
          jump = Math.sin(p * Math.PI) * 0.28;
        }
      }
      r.position.y = amp + jump;
      r.rotation.z = reducedMotion ? 0 : Math.sin(t * 0.9) * 0.05;
      r.rotation.y = spinExtra;
    }

    // — Kepala mengikuti kursor (lerp halus) —
    const h = head.current;
    if (h) {
      const k = Math.min(1, dt * 6);
      if (interactive) {
        // y global: +1 di bawah → rotation.x negatif = menunduk ke kursor.
        h.rotation.y += (pointer.current.x * 0.55 - h.rotation.y) * k;
        h.rotation.x += (-pointer.current.y * 0.3 - h.rotation.x) * k;
      } else {
        h.rotation.y += (Math.sin(t * 0.6) * 0.12 - h.rotation.y) * Math.min(1, dt * 3);
        h.rotation.x *= 0.95;
      }
    }

    // — Bola mata bergeser ke arah kursor —
    // Amplitudo kecil (tidak sampai keluar layar wajah) + lerp lebih cepat
    // (dt*10 vs kepala dt*6) sehingga mata bergerak mendahului kepala.
    {
      const ke = Math.min(1, dt * 10);
      const exT = interactive ? pointer.current.x * 0.055 : 0; // geser horizontal
      const eyT = interactive ? -pointer.current.y * 0.04 : 0; // geser vertikal
      if (eyeL.current) {
        eyeL.current.position.x += (-0.24 + exT - eyeL.current.position.x) * ke;
        eyeL.current.position.y += (0.22 + eyT - eyeL.current.position.y) * ke;
      }
      if (eyeR.current) {
        eyeR.current.position.x += (0.24 + exT - eyeR.current.position.x) * ke;
        eyeR.current.position.y += (0.22 + eyT - eyeR.current.position.y) * ke;
      }
    }

    // — Kedip mata acak —
    let eyeY = 1;
    if (blinkT.current < 0 && t >= nextBlink.current) blinkT.current = 0;
    if (blinkT.current >= 0) {
      blinkT.current += dt / 0.16;
      if (blinkT.current >= 1) {
        blinkT.current = -1;
        nextBlink.current = t + 1.8 + Math.random() * 3.2;
      } else {
        eyeY = 1 - Math.sin(blinkT.current * Math.PI) * 0.92;
      }
    }
    if (eyeL.current) eyeL.current.scale.y = eyeY;
    if (eyeR.current) eyeR.current.scale.y = eyeY;

    // — Lengan kanan melambaikan (angkat → goyang ±5× → turun) —
    if (armR.current) {
      const k = Math.min(1, dt * 12);
      let target = 0.15; // pose istirahat: sedikit terbuka ke samping
      if (waveT.current >= 0) {
        waveT.current += dt / 1.6; // durasi total 1.6 detik
        const p = waveT.current;
        if (p >= 1) waveT.current = -1;
        else if (p < 0.15) {
          target = (p / 0.15) * Math.PI * 0.85; // angkat ke atas
        } else if (p < 0.85) {
          // goyang kiri-kanan di posisi atas
          target = Math.PI * 0.85 + Math.sin((p - 0.15) * Math.PI * 14) * 0.35;
        } else {
          const e = (p - 0.85) / 0.15;
          target = Math.PI * 0.85 * (1 - e); // turun ke pose istirahat
        }
      }
      armR.current.rotation.z += (target - armR.current.rotation.z) * k;
    }

    // — Mulut bicara + antena berdenyut —
    talkPhase.current += dt * (speaking ? 13 : 4);
    if (mouth.current) {
      const open = speaking
        ? 0.55 + Math.abs(Math.sin(talkPhase.current)) * 0.75
        : 0.4;
      mouth.current.scale.y += (open - mouth.current.scale.y) * Math.min(1, dt * 14);
    }
    if (antennaTip.current) {
      const pulse = speaking
        ? 1 + Math.sin(t * 10) * 0.25
        : 1 + Math.sin(t * 2) * 0.06;
      antennaTip.current.scale.setScalar(pulse);
    }
  });

  /** Reaksi klik: mulai animasi putar bila sedang tidak berputar. */
  const poke = () => {
    if (spinT.current < 0) spinT.current = 0;
  };

  return (
    <group ref={root} onPointerDown={poke} scale={0.88}>
      {/* ===== Kepala (ikut kursor) — topi & antena ikut berputar ===== */}
      <group ref={head}>
        {/* Topi jerami wisatawan 🌾 */}
        {/* brim (bibir topi) */}
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[1.12, 1.18, 0.06, 36]} />
          <meshStandardMaterial color={C.straw} roughness={0.85} metalness={0} />
        </mesh>
        {/* mahkota topi */}
        <mesh position={[0, 0.92, 0]}>
          <cylinderGeometry args={[0.52, 0.62, 0.34, 28]} />
          <meshStandardMaterial color={C.strawDark} roughness={0.85} metalness={0} />
        </mesh>
        {/* puncak mahkota (kubah) */}
        <mesh position={[0, 1.09, 0]} scale={[1, 0.45, 1]}>
          <sphereGeometry args={[0.52, 28, 16]} />
          <meshStandardMaterial color={C.strawDark} roughness={0.85} metalness={0} />
        </mesh>
        {/* pita hijau topi */}
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.63, 0.63, 0.11, 28]} />
          <meshStandardMaterial color={C.body} roughness={0.6} />
        </mesh>

        {/* Antena menembus puncak topi */}
        <mesh position={[0, 1.12, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.42, 12]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh ref={antennaTip} position={[0, 1.4, 0]}>
          <sphereGeometry args={[0.09, 20, 20]} />
          <meshStandardMaterial
            color={C.eye}
            emissive={C.eyeGlow}
            emissiveIntensity={speaking ? 2.2 : 1.1}
          />
        </mesh>
        <RoundedBox
          args={[1.5, 1.15, 1.15]}
          radius={0.22}
          smoothness={6}
          position={[0, 0.1, 0]}
        >
          <meshStandardMaterial color={C.body} metalness={0.15} roughness={0.3} />
        </RoundedBox>

        {/* layar wajah gelap */}
        <RoundedBox
          args={[1.14, 0.74, 0.12]}
          radius={0.09}
          smoothness={6}
          position={[0, 0.1, 0.55]}
        >
          <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.25} />
        </RoundedBox>

        {/* mata menyala biru */}
        <mesh ref={eyeL} position={[-0.24, 0.22, 0.63]}>
          <capsuleGeometry args={[0.075, 0.09, 8, 16]} />
          <meshStandardMaterial color={C.eye} emissive={C.eyeGlow} emissiveIntensity={1.6} />
        </mesh>
        <mesh ref={eyeR} position={[0.24, 0.22, 0.63]}>
          <capsuleGeometry args={[0.075, 0.09, 8, 16]} />
          <meshStandardMaterial color={C.eye} emissive={C.eyeGlow} emissiveIntensity={1.6} />
        </mesh>

        {/* mulut */}
        <RoundedBox
          ref={mouth}
          args={[0.34, 0.1, 0.05]}
          radius={0.04}
          smoothness={4}
          position={[0, -0.08, 0.63]}
        >
          <meshStandardMaterial color={C.eye} emissive={C.eyeGlow} emissiveIntensity={1.2} />
        </RoundedBox>

        {/* pod telinga kiri & kanan */}
        {[-0.82, 0.82].map((x) => (
          <mesh key={x} position={[x, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 0.14, 20]} />
            <meshStandardMaterial color={C.accent} metalness={0.3} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* leher */}
      <mesh position={[0, -0.62, 0]}>
        <cylinderGeometry args={[0.18, 0.26, 0.22, 16]} />
        <meshStandardMaterial color={C.light} metalness={0.2} roughness={0.5} />
      </mesh>

      {/* bahu/badan atas */}
      <RoundedBox args={[0.9, 0.35, 0.7]} radius={0.12} smoothness={4} position={[0, -0.88, 0]}>
        <meshStandardMaterial color={C.bodyDark} metalness={0.15} roughness={0.35} />
      </RoundedBox>

      {/* lengan kiri (pose istirahat, sedikit terbuka) */}
      <group position={[-0.51, -0.95, 0]} rotation={[0, 0, -0.15]}>
        <mesh position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.11, 0.22, 8, 16]} />
          <meshStandardMaterial color={C.bodyDark} metalness={0.15} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={C.accent} metalness={0.3} roughness={0.4} />
        </mesh>
      </group>

      {/* lengan kanan — pivot di bahu, melambaikan saat jendela chat dibuka */}
      <group ref={armR} position={[0.51, -0.95, 0]} rotation={[0, 0, 0.15]}>
        <mesh position={[0, -0.16, 0]}>
          <capsuleGeometry args={[0.11, 0.22, 8, 16]} />
          <meshStandardMaterial color={C.bodyDark} metalness={0.15} roughness={0.35} />
        </mesh>
        <mesh position={[0, -0.34, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={C.accent} metalness={0.3} roughness={0.4} />
        </mesh>
      </group>

      {/* lampu indikator dada (amber, senada titik notifikasi FAB) */}
      <mesh position={[0, -0.86, 0.36]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color={C.indicator} emissive="#f59e0b" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

interface Robot3DProps {
  /** Robot sedang berbicara (mulut & antena beranimasi). */
  speaking?: boolean;
  /** Kepala mengikuti kursor. */
  interactive?: boolean;
  /** Mainkan animasi lambaikan tangan sekali (dipicu saat chat dibuka). */
  wave?: boolean;
  /** Callback tambahan saat robot diklik (mis. SFX). */
  onPoke?: () => void;
}

/** Deteksi dukungan WebGL — bila gagal, pemanggil menampilkan ikon fallback. */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

export default function Robot3D({
  speaking = false,
  interactive = true,
  wave = false,
  onPoke,
}: Robot3DProps) {
  const supported = useMemo(hasWebGL, []);
  const reducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  );

  if (!supported) return <Bot size={26} />;

  return (
    <div
      style={{ width: '100%', height: '100%' }}
      onPointerDown={onPoke}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.1, 4.2], fov: 38 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <directionalLight position={[-3, -1, 2]} intensity={0.4} color="#86efac" />
        <Suspense fallback={null}>
          <RobotScene
            speaking={speaking}
            interactive={interactive}
            reducedMotion={reducedMotion}
            wave={wave}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
