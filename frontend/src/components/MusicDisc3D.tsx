/**
 * MusicDisc3D — piringan hitam (vinyl) 3D untuk tombol music player.
 *
 * Render: three.js via @react-three/fiber, di-lazy-load dari MusicPlayer
 * sehingga tidak menambah beban muat awal. Bila WebGL tidak tersedia,
 * fallback ke ikon Music biasa.
 *
 * Perilaku:
 *  - `playing`: piringan berputar penuh + glow hijau berdenyut senada musik.
 *    Saat berhenti/mute: rotasi melambat dengan inersia hingga berhenti.
 *  - Mengikuti kursor: piringan mencondong ke arah pointer (efek tilt 3D).
 *  - Menghormati prefers-reduced-motion (tanpa rotasi/glow berdenyut).
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Music } from 'lucide-react';

interface DiscSceneProps {
  playing: boolean;
  reducedMotion: boolean;
}

function DiscScene({ playing, reducedMotion }: DiscSceneProps) {
  const disc = useRef<THREE.Group>(null); // rotasi piringan
  const tilt = useRef<THREE.Group>(null); // condong mengikuti kursor
  const glow = useRef<THREE.Mesh>(null); // cincin glow label

  const spin = useRef(0); // kecepatan sudut saat ini (rad/detik)
  const target = useRef(0); // kecepatan target
  // Posisi kursor global (dinormalisasi -1..1), sama pola dengan Robot3D.
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    // — Inersia putar: menuju kecepatan target secara halus —
    // 33⅓ RPM ~ 3.49 rad/s. reducedMotion: tidak pernah berputar.
    target.current = playing && !reducedMotion ? 3.49 : 0;
    spin.current += (target.current - spin.current) * Math.min(1, dt * 2.2);
    if (disc.current) disc.current.rotation.z -= spin.current * dt;

    // — Condong ke arah kursor (lerp halus, sama pola dengan Robot3D) —
    if (tilt.current) {
      const k = Math.min(1, dt * 6);
      tilt.current.rotation.y += (pointer.current.x * 0.4 - tilt.current.rotation.y) * k;
      tilt.current.rotation.x += (pointer.current.y * 0.3 - tilt.current.rotation.x) * k;
    }

    // — Glow label berdenyut saat memutar —
    if (glow.current) {
      const mat = glow.current.material as THREE.MeshStandardMaterial;
      const targetInt = playing && !reducedMotion ? 1.4 + Math.sin(t * 4) * 0.5 : 0.25;
      mat.emissiveIntensity += (targetInt - mat.emissiveIntensity) * Math.min(1, dt * 6);
    }
  });

  // Lacak kursor global (listener window — pola sama dengan Robot3D)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <group ref={tilt}>
      <group ref={disc}>
        {/* badan piringan: silinder tipis hitam mengkilap, wajah menghadap kamera */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1, 1, 0.07, 48]} />
          <meshStandardMaterial color="#111827" roughness={0.35} metalness={0.55} />
        </mesh>
        {/* alur (grooves): lingkaran konsentris DI ATAS wajah depan (z+) —
            tanpa rotasi: torus default memang menghadap kamera */}
        {[0.5, 0.66, 0.82].map((r) => (
          <mesh key={r} position={[0, 0, 0.044]}>
            <torusGeometry args={[r, 0.008, 8, 48]} />
            <meshStandardMaterial color="#334155" roughness={0.45} metalness={0.5} />
          </mesh>
        ))}
        {/* label tengah hijau: DIROTASI sama dengan badan agar wajah
            lingkarannya menghadap kamera, dan tepat di tengah */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.078, 32]} />
          <meshStandardMaterial
            color="#16a34a"
            emissive="#22c55e"
            emissiveIntensity={0.35}
            roughness={0.5}
          />
        </mesh>
        {/* lubang poros tengah: tepat di pusat, menembus dua wajah */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.1, 16]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
        </mesh>
        {/* cincin glow berdenyut: menghadap kamera (tanpa rotasi),
            melayang sedikit di depan wajah antara label & grooves */}
        <mesh ref={glow} position={[0, 0, 0.05]}>
          <torusGeometry args={[0.43, 0.02, 8, 48]} />
          <meshStandardMaterial
            color="#4ade80"
            emissive="#22c55e"
            emissiveIntensity={0.25}
            transparent
            opacity={0.9}
          />
        </mesh>
        {/* kilau permukaan: garis tangensial tipis di wajah depan,
            ikut berputar bersama piringan */}
        <mesh position={[0.7, 0, 0.046]}>
          <boxGeometry args={[0.018, 0.3, 0.012]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

interface MusicDisc3DProps {
  /** Musik sedang diputar — piringan berputar & glow menyala. */
  playing: boolean;
}

export default function MusicDisc3D({ playing }: MusicDisc3DProps) {
  // Deteksi WebGL & reduced motion (pola sama dengan Robot3D)
  const supported = useMemo(() => {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
      );
    } catch {
      return false;
    }
  }, []);
  const reducedMotion = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  );

  if (!supported) return <Music size={16} />;

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.45, 3.0], fov: 42 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} />
        <directionalLight position={[-2, -1, 2]} intensity={0.3} color="#86efac" />
        <DiscScene playing={playing} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
