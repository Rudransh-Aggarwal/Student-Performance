import { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useTheme } from '../context/ThemeContext';
import { usePrefersReducedMotion } from '../hooks/useMediaQuery';
import { supportsWebGL } from '../lib/webgl';

const PALETTE = {
  dark: { point: '#a3ad9b' },
  light: { point: '#697565' },
};

// Energy builds from scrolling and mouse movement, then decays to zero.
// Time only advances while energy is above zero, so the waves freeze when idle.
const SCROLL_ENERGY = 6;
const POINTER_ENERGY = 4;
const MAX_ENERGY_INPUT = 3;
const DECAY = 2.5;

const VERTEX_SHADER = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPointerX;
  uniform float uPointerY;
  uniform float uInteract;
  uniform float uPixelRatio;
  varying float vHeight;

  void main() {
    vec3 p = position;
    float swell = sin(p.x * 0.7 + uTime * 0.6 + uProgress * 3.0) * cos(p.y * 0.6 - uTime * 0.4);
    float dist = length(p.xy - vec2(uPointerX * 6.0, uPointerY * 4.0));
    float ripple = sin(dist * 1.4 - uTime * 1.2) * exp(-dist * 0.35) * uInteract;
    p.z = swell * (0.9 + uProgress * 0.8) + ripple * 0.9;
    vHeight = p.z;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uPixelRatio * (2.2 / -mvPosition.z) * 9.0;
  }
`;

const FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vHeight;

  void main() {
    vec2 offset = gl_PointCoord - 0.5;
    float distanceFromCenter = length(offset);
    if (distanceFromCenter > 0.5) discard;
    float edge = smoothstep(0.5, 0.0, distanceFromCenter);
    float brightness = 0.35 + 0.65 * smoothstep(-1.2, 1.2, vHeight);
    gl_FragColor = vec4(uColor, edge * brightness * uOpacity);
  }
`;

function Field({ color, reduced, progressRef }) {
  const dpr = useThree((state) => state.viewport.dpr);

  const timeRef = useRef(0);
  const energyRef = useRef(0);
  const lastProgressRef = useRef(0);
  const lastMouseRef = useRef(null);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });

  const geometry = useMemo(() => new THREE.PlaneGeometry(18, 18, 110, 110), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uPointerX: { value: 0 },
          uPointerY: { value: 0 },
          uInteract: { value: 0 },
          uPixelRatio: { value: 1 },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: 0.75 },
        },
        transparent: true,
        depthWrite: false,
      }),
    // Created once; colour and pixel ratio are kept in sync through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.uniforms.uColor.value.set(color);
  }, [color, material]);

  useEffect(() => {
    material.uniforms.uPixelRatio.value = dpr;
  }, [dpr, material]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // Mouse movement feeds energy and sets the ripple target. Listening on window means the
  // sections above the canvas don't block it.
  useEffect(() => {
    if (reduced) return undefined;

    function handleMove(event) {
      const x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      const y = -((event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
      pointerTargetRef.current = { x, y };

      const last = lastMouseRef.current;
      if (last) {
        const moved = Math.hypot(x - last.x, y - last.y);
        energyRef.current = Math.min(energyRef.current + Math.min(moved * POINTER_ENERGY, MAX_ENERGY_INPUT), 4);
      }
      lastMouseRef.current = { x, y };
    }

    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => window.removeEventListener('pointermove', handleMove);
  }, [reduced]);

  useFrame((_state, delta) => {
    const progress = progressRef.current;

    // Scrolling feeds energy in proportion to how far the chapter cursor moved this frame.
    const scrolled = Math.abs(progress - lastProgressRef.current);
    lastProgressRef.current = progress;
    if (!reduced) {
      energyRef.current = Math.min(energyRef.current + scrolled * SCROLL_ENERGY, 4);
    }

    energyRef.current *= Math.exp(-delta * DECAY);
    const energy = reduced ? 0 : Math.min(energyRef.current, 1.5);

    timeRef.current += delta * energy;

    // Ease the ripple toward the mouse so it doesn't jump between events.
    const current = pointerCurrentRef.current;
    const target = pointerTargetRef.current;
    const ease = Math.min(1, delta * 8);
    current.x += (target.x - current.x) * ease;
    current.y += (target.y - current.y) * ease;

    const uniforms = material.uniforms;
    uniforms.uTime.value = timeRef.current;
    uniforms.uProgress.value = progress;
    uniforms.uPointerX.value = current.x;
    uniforms.uPointerY.value = current.y;
    uniforms.uInteract.value = Math.min(energy, 1);
  });

  return <points geometry={geometry} material={material} rotation={[-1.05, 0, 0]} position={[0, -1.4, 0]} />;
}

function CssFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(to_top,var(--accent-soft),transparent)] opacity-60" />
    </div>
  );
}

class SceneErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Fixed background scene. `progressRef` (0..1) is written by the landing page on scroll. */
export function HeroCanvas({ progressRef }) {
  const { theme } = useTheme();
  const reduced = usePrefersReducedMotion();
  const [webgl] = useState(() => supportsWebGL());
  const palette = PALETTE[theme] ?? PALETTE.dark;

  if (!webgl) {
    return (
      <div className="absolute inset-0">
        <CssFallback />
      </div>
    );
  }

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <SceneErrorBoundary fallback={<CssFallback />}>
        <Canvas
          dpr={[1, 1.75]}
          frameloop="always"
          camera={{ position: [0, 1.4, 7], fov: 40 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Field color={palette.point} reduced={reduced} progressRef={progressRef} />
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}