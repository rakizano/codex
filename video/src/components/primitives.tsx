import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {Palette, Segment} from '../types';

export const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

/** Temps local (s) depuis le début de la scène (la Sequence remet le frame à 0). */
export const useT = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return f / fps;
};

export const usePop = (delayS = 0, damping = 12) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: f - delayS * fps, fps, config: {damping, mass: 0.6}});
};

/** Moment (s, relatif à la scène) où un mot clé est prononcé. */
export const wordTime = (seg: Segment, needle: string) => {
  const n = needle.toLowerCase();
  const w = seg.words.find((x) => x.w.toLowerCase().replace(/[^\p{L}\d-]/gu, '').startsWith(n.split(' ')[0]));
  return w ? w.start - seg.start : 0;
};

export const ease = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.2, 0.8, 0.2, 1)});

/** KineticWord : mot qui arrive avec rebond, échelle et légère rotation. */
export const KineticWord: React.FC<{text: string; at?: number; size?: number; color: string; x?: number; y?: number; rot?: number; weight?: number}> = ({text, at = 0, size = 120, color, x = 540, y = 600, rot = -3, weight = 900}) => {
  const s = usePop(at, 10);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${s}) rotate(${(1 - s) * rot * 4 + rot}deg)`, opacity: Math.min(1, s * 1.5),
      fontFamily: FONT, fontWeight: weight, fontSize: size, color, letterSpacing: -2, whiteSpace: 'nowrap', textTransform: 'uppercase', lineHeight: 1, textShadow: '0 6px 26px #000a'}}>
      {text}
    </div>
  );
};

/** Disque vinyle SVG original. */
export const VinylRecord: React.FC<{size?: number; p: Palette; label?: string; rpm?: number}> = ({size = 600, p, label = '', rpm = 33}) => {
  const t = useT();
  const rot = t * rpm * 6;
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" style={{transform: `rotate(${rot}deg)`}}>
      <circle r={98} fill="#0a0a12" />
      {Array.from({length: 14}).map((_, i) => (
        <circle key={i} r={40 + i * 4} fill="none" stroke="#ffffff" strokeOpacity={0.05 + (i % 3) * 0.02} strokeWidth={0.6} />
      ))}
      <path d="M -60 -70 A 92 92 0 0 1 40 -84" stroke="#fff" strokeOpacity={0.18} strokeWidth={3} fill="none" />
      <circle r={34} fill={p.accent} />
      <circle r={34} fill="none" stroke={p.bg} strokeWidth={2} />
      <text y={-6} textAnchor="middle" fontSize={label.length > 10 ? 5.5 : 9} fontWeight={800} fill={p.bg} fontFamily={FONT}>{label}</text>
      <text y={8} textAnchor="middle" fontSize={5} fill={p.bg} fontFamily={FONT}>33⅓ RPM</text>
      <circle r={3} fill={p.bg} />
    </svg>
  );
};

/** Barres d'égaliseur pilotées par une pseudo-énergie déterministe. */
export const WaveformVisualizer: React.FC<{p: Palette; bars?: number; width?: number; height?: number; color?: string}> = ({p, bars = 32, width = 900, height = 160, color}) => {
  const t = useT();
  const bw = width / bars;
  return (
    <svg width={width} height={height}>
      {Array.from({length: bars}).map((_, i) => {
        const e = 0.25 + 0.75 * Math.abs(Math.sin(t * 3.1 + i * 0.7) * Math.sin(t * 1.7 + i * 0.31));
        const h = e * height;
        return <rect key={i} x={i * bw + 2} y={(height - h) / 2} width={bw - 4} height={h} rx={bw / 2} fill={color ?? p.main} opacity={0.85} />;
      })}
    </svg>
  );
};

/** Silhouette humaine stylisée (originale). */
export const Person: React.FC<{x: number; y: number; s?: number; color: string; arm?: number; glass?: boolean; accent?: string}> = ({x, y, s = 1, color, arm = 0, glass, accent}) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <circle cx={0} cy={-150} r={34} fill={color} />
    <path d="M -45 -105 Q 0 -120 45 -105 L 55 40 L -55 40 Z" fill={color} />
    <g transform={`translate(40,-95) rotate(${-arm})`}>
      <rect x={0} y={-8} width={80} height={18} rx={9} fill={color} />
      {glass && (
        <g transform="translate(78,-38)">
          <path d="M -14 0 L 14 0 L 10 36 L -10 36 Z" fill="none" stroke={accent} strokeWidth={4} />
          <path d="M -12 12 L 12 12 L 10 36 L -10 36 Z" fill={accent} opacity={0.8} />
        </g>
      )}
    </g>
  </g>
);

/** Verre qui se remplit (niveau 0..1). */
export const Glass: React.FC<{level: number; p: Palette; w?: number; h?: number}> = ({level, p, w = 260, h = 380}) => {
  const t = useT();
  const lh = h * 0.92 * level;
  const wave = (k: number) => Math.sin(t * 4 + k) * 6;
  return (
    <svg width={w + 40} height={h + 40} viewBox={`-20 -20 ${w + 40} ${h + 40}`}>
      <defs>
        <clipPath id="glassclip"><path d={`M 0 0 L ${w} 0 L ${w * 0.85} ${h} L ${w * 0.15} ${h} Z`} /></clipPath>
      </defs>
      <g clipPath="url(#glassclip)">
        <path d={`M -20 ${h - lh + wave(0)} Q ${w / 2} ${h - lh + wave(2) - 14} ${w + 20} ${h - lh + wave(4)} L ${w + 20} ${h + 20} L -20 ${h + 20} Z`} fill={p.accent} opacity={0.85} />
        {Array.from({length: 8}).map((_, i) => {
          const by = h - ((t * 120 + i * 53) % Math.max(1, lh));
          return <circle key={i} cx={30 + ((i * 37) % (w - 60))} cy={by} r={4 + (i % 3) * 2} fill="#fff" opacity={lh > 20 ? 0.5 : 0} />;
        })}
      </g>
      <path d={`M 0 0 L ${w} 0 L ${w * 0.85} ${h} L ${w * 0.15} ${h} Z`} fill="none" stroke={p.ink} strokeWidth={8} strokeLinejoin="round" />
      <path d={`M ${w * 0.12} 20 L ${w * 0.2} ${h * 0.8}`} stroke="#fff" strokeOpacity={0.35} strokeWidth={10} strokeLinecap="round" />
    </svg>
  );
};

export const Chip: React.FC<{text: string; at: number; p: Palette; x: number; y: number; bg?: string}> = ({text, at, p, x, y, bg}) => {
  const s = usePop(at, 14);
  return (
    <div style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${s})`, background: bg ?? p.main, color: p.bg,
      fontFamily: FONT, fontWeight: 800, fontSize: 46, padding: '14px 32px', borderRadius: 999, whiteSpace: 'nowrap'}}>{text}</div>
  );
};
