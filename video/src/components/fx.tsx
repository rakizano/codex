import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {EpisodeProps, Palette} from '../types';

/** Contexte global : temps absolu (s) depuis le début de la vidéo + infos beat. */
export const BeatContext = React.createContext<{beats: number[]; energy: number[]; offset: number}>({beats: [], energy: [], offset: 0});

/** Pulsation 0..1 qui retombe après chaque temps (synchronisée sur le beat réellement généré). */
export const useBeat = (absFrom = 0) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {beats, energy} = React.useContext(BeatContext);
  const t = absFrom + f / fps;
  let i = -1;
  for (let k = 0; k < beats.length && beats[k] <= t; k++) i = k;
  if (i < 0) return {pulse: 0, energy: 0, index: 0, downbeat: false};
  const dt = t - beats[i];
  const e = energy[i] ?? 1;
  return {pulse: Math.exp(-dt * 7) * e, energy: e, index: i, downbeat: i % 4 === 0};
};

/** Grain de pellicule animé (SVG turbulence, graine différente toutes les 2 images). */
export const Grain: React.FC<{opacity?: number}> = ({opacity = 0.07}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'overlay', opacity}}>
      <svg width="100%" height="100%">
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={Math.floor(f / 2)} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Particules flottantes (poussière lumineuse), déterministes. */
export const Particles: React.FC<{color: string; count?: number; seed?: string}> = ({color, count = 26, seed = 'p'}) => {
  const f = useCurrentFrame();
  const {pulse} = useBeat(0);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={1080} height={1920}>
        {Array.from({length: count}).map((_, i) => {
          const x0 = random(`${seed}x${i}`) * 1080, y0 = random(`${seed}y${i}`) * 1920;
          const sp = 0.3 + random(`${seed}s${i}`) * 0.9, r = 2 + random(`${seed}r${i}`) * 5;
          const y = (y0 - f * sp * 2 + 1920 * 4) % 1920; const x = x0 + Math.sin(f / 40 + i) * 20;
          return <circle key={i} cx={x} cy={y} r={r * (1 + pulse * 0.6)} fill={color} opacity={0.12 + 0.25 * random(`${seed}o${i}`)} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** Fond vivant : deux taches de couleur qui dérivent + vignette, respirent au beat. */
export const LiveBackground: React.FC<{p: Palette}> = ({p}) => {
  const f = useCurrentFrame();
  const {pulse} = useBeat(0);
  const a = {x: 50 + Math.sin(f / 90) * 25, y: 30 + Math.cos(f / 110) * 12};
  const b = {x: 50 + Math.cos(f / 70) * 30, y: 75 + Math.sin(f / 80) * 10};
  return (
    <AbsoluteFill style={{background: p.bg}}>
      <AbsoluteFill style={{background: `radial-gradient(circle at ${a.x}% ${a.y}%, ${p.main}${pulse > 0.5 ? '40' : '30'} 0%, transparent 45%), radial-gradient(circle at ${b.x}% ${b.y}%, ${p.accent}22 0%, transparent 40%)`}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 55%, #000000aa 100%)'}} />
    </AbsoluteFill>
  );
};

/** Caméra : lent push-in permanent + « punch » sur les impacts + tremblement optionnel. */
export const Camera: React.FC<{children: React.ReactNode; punches?: number[]; shake?: number[]; drift?: number}> = ({children, punches = [], shake = [], drift = 0.06}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  let s = 1 + drift * (f / Math.max(1, durationInFrames));
  for (const p of punches) { const d = t - p; if (d >= 0 && d < 0.6) s += 0.08 * Math.exp(-d * 8); }
  let dx = 0, dy = 0;
  for (const sh of shake) { const d = t - sh; if (d >= 0 && d < 0.5) { const k = Math.exp(-d * 9) * 18; dx += Math.sin(f * 2.1) * k; dy += Math.cos(f * 2.7) * k; } }
  return <AbsoluteFill style={{transform: `translate(${dx}px, ${dy}px) scale(${s})`}}>{children}</AbsoluteFill>;
};

/** Transition en volet diagonal (couvre puis révèle) — placée à chaque changement de scène. */
export const WipeTransition: React.FC<{p: Palette; color?: string; dir?: 1 | -1}> = ({p, color, dir = 1}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const k = f / (0.5 * fps); // 0..1 sur 0,5 s
  const pos = interpolate(k, [0, 0.5, 1], [-1.3, 0, 1.3], {easing: Easing.inOut(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (k >= 1) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: -600, top: -600, width: 2400, height: 3200, background: color ?? p.main,
        transform: `translateX(${pos * 2300 * dir}px) skewX(-18deg)`}} />
      <div style={{position: 'absolute', left: -600, top: -600, width: 2400, height: 3200, background: p.bg,
        transform: `translateX(${(pos - 0.18) * 2300 * dir}px) skewX(-18deg)`, borderLeft: `40px solid ${p.accent}`}} />
    </AbsoluteFill>
  );
};

/** Barres audio réactives au beat (visualisent la musique en continu en bas d'écran). */
export const BeatBars: React.FC<{p: Palette; y?: number; bars?: number; height?: number; opacity?: number}> = ({p, y = 1800, bars = 48, height = 90, opacity = 0.5}) => {
  const f = useCurrentFrame();
  const {pulse, energy} = useBeat(0);
  const w = 1080 / bars;
  return (
    <svg width={1080} height={height} style={{position: 'absolute', left: 0, top: y - height, opacity}}>
      {Array.from({length: bars}).map((_, i) => {
        const base = 0.15 + 0.35 * Math.abs(Math.sin(f / 9 + i * 0.6) * Math.cos(f / 13 + i * 0.23));
        const h = (base + pulse * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7)))) * height * (0.4 + 0.6 * energy);
        return <rect key={i} x={i * w + 2} y={height - h} width={w - 4} height={h} rx={3} fill={i % 7 === 0 ? p.accent : p.main} />;
      })}
    </svg>
  );
};

/** Texte machine à écrire. */
export const Typewriter: React.FC<{text: string; start: number; cps?: number; style?: React.CSSProperties}> = ({text, start, cps = 28, style}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const n = Math.max(0, Math.floor((f / fps - start) * cps));
  return <span style={style}>{text.slice(0, n)}<span style={{opacity: f % 16 < 8 && n < text.length ? 1 : 0}}>▍</span></span>;
};

/** Surligneur qui balaie un texte. */
export const Highlighter: React.FC<{at: number; color: string; children: React.ReactNode}> = ({at, color, children}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const k = interpolate(f / fps, [at, at + 0.45], [0, 100], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <span style={{backgroundImage: `linear-gradient(${color}, ${color})`, backgroundRepeat: 'no-repeat', backgroundSize: `${k}% 42%`, backgroundPosition: '0 88%'}}>{children}</span>;
};

/** Tracé qui se dessine (stroke-dashoffset). */
export const DrawPath: React.FC<{d: string; progress: number; stroke: string; width?: number; len?: number}> = ({d, progress, stroke, width = 20, len = 1400}) => progress <= 0.01 ? null : (
  <path d={d} stroke={stroke} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - Math.max(0, Math.min(1, progress)))} />
);

/** Éclats (particules radiales) pour impacts / splash / confettis. */
export const Burst: React.FC<{at: number; x: number; y: number; color: string; n?: number; spread?: number; seed?: string; gravity?: number}> = ({at, x, y, color, n = 22, spread = 420, seed = 'b', gravity = 900}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps - at;
  if (t < 0 || t > 1.4) return null;
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}>
      {Array.from({length: n}).map((_, i) => {
        const ang = -Math.PI * (0.1 + 0.8 * random(`${seed}a${i}`)); const v = spread * (0.5 + random(`${seed}v${i}`));
        const px = x + Math.cos(ang) * v * t; const py = y + Math.sin(ang) * v * t + 0.5 * gravity * t * t;
        return <circle key={i} cx={px} cy={py} r={(4 + 8 * random(`${seed}r${i}`)) * (1 - t / 1.4)} fill={color} opacity={1 - t / 1.4} />;
      })}
    </svg>
  );
};

export const beatsFromProps = (ep: EpisodeProps) => ({beats: ep.beats ?? [], energy: ep.energy ?? [], offset: 0});
