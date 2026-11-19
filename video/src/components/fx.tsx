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
/** Plan de caméra (Bang Motion §3b « ukuran shot ») : à `at` s, la caméra cadre (x, y) avec l'échelle s. */
export type Shot = {at: number; s: number; x?: number; y?: number; dur?: number};

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** Caméra : plans (wide ↔ medium close-up ↔ close-up) vers l'élément qui raconte, push lent pendant les tenues,
 *  « punch » sur les impacts, tremblement. Les bords du monde ne sont jamais révélés (clamp). */
export const Camera: React.FC<{children: React.ReactNode; punches?: number[]; shake?: number[]; drift?: number; shots?: Shot[]}> = ({children, punches = [], shake = [], drift = 0.05, shots = []}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps;
  // plan courant : interpolation ease-in-out du plan précédent vers le suivant
  let cur = {s: 1, x: 540, y: 960};
  const list = [{at: -1, s: 1, x: 540, y: 960, dur: 0}, ...shots].sort((a, b) => a.at - b.at);
  for (let i = 1; i < list.length; i++) {
    const sh = list[i]; if (t < sh.at) break;
    const prev = cur; const k = easeInOut(Math.min(1, (t - sh.at) / (sh.dur ?? 0.8)));
    cur = {s: prev.s + (sh.s - prev.s) * k, x: prev.x + ((sh.x ?? 540) - prev.x) * k, y: prev.y + ((sh.y ?? 960) - prev.y) * k};
  }
  let s = cur.s * (1 + drift * (f / Math.max(1, durationInFrames)));   // push lent pendant la tenue
  for (const p of punches) { const d = t - p; if (d >= 0 && d < 0.6) s *= 1 + 0.08 * Math.exp(-d * 8); }
  let tx = 540 - cur.x * s, ty = 960 - cur.y * s;
  tx = Math.min(0, Math.max(1080 - 1080 * s, tx)); ty = Math.min(0, Math.max(1920 - 1920 * s, ty));
  if (s < 1) { tx = (1080 - 1080 * s) / 2; ty = (1920 - 1920 * s) / 2; }
  for (const sh of shake) { const d = t - sh; if (d >= 0 && d < 0.5) { const k = Math.exp(-d * 9) * 18; tx += Math.sin(f * 2.1) * k; ty += Math.cos(f * 2.7) * k; } }
  return <AbsoluteFill style={{transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})`}}>{children}</AbsoluteFill>;
};

/** Transitions Bang Motion §4c (menu, jamais la même deux fois de suite, objet-wipe ≤ 2). */
export type TransitionKind = 'push' | 'rotY' | 'rack' | 'whip' | 'vinyl' | 'leak';
const pw2in = (k: number) => k * k, pw4out = (k: number) => 1 - Math.pow(1 - k, 4);

/** Enveloppe de scène : entrée lente et appuyée (0,8 s, power4.out), sortie rapide (0,45 s, power2.in), qui se chevauchent. */
export const SceneShell: React.FC<{children: React.ReactNode; enter?: TransitionKind; exit?: TransitionKind; exitAt: number; dir?: number}> = ({children, enter, exit, exitAt, dir = 1}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const e = enter ? pw4out(Math.min(1, t / 0.8)) : 1;
  const x = exit ? pw2in(Math.max(0, Math.min(1, (t - exitAt) / 0.45))) : 0;
  let tr = '', blur = 0, op = 1;
  // entrée
  if (enter === 'push') { tr += ` scale(${0.72 + 0.28 * e})`; blur += (1 - e) * 14; op *= Math.min(1, e * 1.6); }
  if (enter === 'rotY') { tr += ` perspective(1400px) translateZ(${-320 * (1 - e)}px) rotateY(${-35 * (1 - e) * dir}deg)`; op *= Math.min(1, e * 1.5); }
  if (enter === 'rack') { tr += ` scale(${1.18 - 0.18 * e})`; blur += (1 - e) * 16; }
  if (enter === 'whip') { tr += ` translateX(${190 * (1 - e) * dir}px)`; blur += (1 - e) * 18; }
  if (enter === 'leak' || enter === 'vinyl') { op *= Math.min(1, e * 2); }
  // sortie
  if (exit === 'push') { tr += ` scale(${1 + 1.3 * x})`; blur += 20 * x; op *= 1 - x; }
  if (exit === 'rotY') { tr += ` perspective(1400px) rotateY(${38 * x * dir}deg) scale(${1 - 0.12 * x})`; op *= 1 - x; }
  if (exit === 'rack') { tr += ` scale(${1 - 0.15 * x})`; blur += 18 * x; op *= 1 - 0.85 * x; }
  if (exit === 'whip') { tr += ` translateX(${-200 * x * dir}px)`; blur += 20 * x; op *= 1 - x; }
  if (exit === 'leak' || exit === 'vinyl') { op *= 1 - x; }
  return <AbsoluteFill style={{transform: tr || undefined, filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined, opacity: op}}>{children}</AbsoluteFill>;
};

/** Objet qui traverse l'objectif AVEC ÉPAISSEUR (vinyle 3D) : couvre le cadre pile sur la coupe. */
export const VinylThroughLens: React.FC<{p: Palette; dir?: number}> = ({p, dir = 1}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const k = Math.min(1, f / (1.0 * fps));           // 1 s, pic à 0,5 s (= la coupe)
  if (k >= 1) return null;
  const sc = 0.25 + 3.2 * Math.sin(Math.PI * k) ** 1.5;
  const x = 540 + dir * (-700 + 1400 * k), y = 1500 - 1100 * k;
  const blur = Math.abs(Math.cos(Math.PI * k)) * 6;
  const disc = (dz: number, shade: string) => (
    <g transform={`translate(0, ${dz})`}>
      <circle r={300} fill={shade} />
      {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} r={140 + i * 26} fill="none" stroke="#ffffff" strokeOpacity={0.06} strokeWidth={3} />)}
      <circle r={105} fill={p.accent} /><circle r={10} fill={p.bg} />
    </g>
  );
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={1080} height={1920} style={{filter: blur > 0.3 ? `blur(${blur}px)` : undefined}}>
        <g transform={`translate(${x}, ${y}) scale(${sc}) rotate(${dir * 200 * k}) scale(1, 0.82)`}>
          {[22, 16, 10, 4].map((dz) => <circle key={dz} cy={dz} r={300} fill="#04040a" />)}
          {disc(0, '#0b0b16')}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/** Éclat de lumière qui couvre ~50 % du cadre au moment de la coupe (pas 100 %). */
export const LightLeak: React.FC<{p: Palette; dir?: number}> = ({p, dir = 1}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const k = Math.min(1, f / (0.9 * fps));
  if (k >= 1) return null;
  const a = Math.sin(Math.PI * k);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen', opacity: a,
      background: `radial-gradient(ellipse 70% 45% at ${dir > 0 ? 20 + 60 * k : 80 - 60 * k}% 45%, ${p.accent}ee 0%, ${p.accent}55 35%, transparent 70%)`}} />
  );
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

/** Zoom léger sur chaque premier temps de mesure (le cadre « respire » avec la musique). */
export const BeatZoom: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {pulse, downbeat} = useBeat(0);
  const s = 1 + (downbeat ? 0.022 : 0.008) * pulse;
  return <AbsoluteFill style={{transform: `scale(${s})`}}>{children}</AbsoluteFill>;
};

/** Mots-clés géants en contour qui traversent le fond (typographie cinétique d'arrière-plan). */
export const BackgroundWords: React.FC<{ep: EpisodeProps}> = ({ep}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps - ep.voiceOffset;
  const seg = [...ep.segments].reverse().find((s) => t >= s.start - 0.3) ?? ep.segments[0];
  const words = (seg.keywords ?? []).slice(0, 2);
  const local = t - seg.start;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      {words.map((w, i) => {
        const x = (i % 2 ? -1 : 1) * (local * 140) + (i % 2 ? 1400 : -900);
        return (
          <div key={`${seg.id}${i}`} style={{position: 'absolute', top: 520 + i * 620, left: 0, whiteSpace: 'nowrap', transform: `translateX(${x}px) rotate(-6deg)`,
            fontFamily: "'Inter', Arial, sans-serif", fontWeight: 900, fontSize: 300, textTransform: 'uppercase', color: 'transparent',
            WebkitTextStroke: `3px ${i % 2 ? ep.palette.accent : ep.palette.main}`, opacity: 0.16}}>{w} · {w} · {w}</div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Anneaux qui s'ouvrent depuis le centre à chaque coupe (calés sur la cymbale). */
export const CutRings: React.FC<{p: Palette}> = ({p}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={1080} height={1920}>
        {[0, 1, 2].map((i) => {
          const k = Math.max(0, Math.min(1, (t - i * 0.08) / 0.7));
          return <circle key={i} cx={540} cy={900} r={60 + k * 900} fill="none" stroke={i === 1 ? p.accent : p.main} strokeWidth={14 * (1 - k)} opacity={(1 - k) * (k > 0 ? 0.8 : 0)} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};
