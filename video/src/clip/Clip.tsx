import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {STAGES} from './stages';
import {BAR, BEAT, pulse} from './rig';

export type ClipProps = {
  title: string;
  /** scènes : nom du panggung + nombre de mesures */
  plan: {stage: keyof typeof STAGES; bars: number; cam: [number, number, number][]; slide?: 'h' | 'v' | 'cut'}[];
  /** décalage (s) du 1er temps fort dans la vidéo */
  offset: number;
  audio?: string | null;
};

/** Caméra de panggung (Hukum 1) : zoom 1,08–1,95, jamais plus large ; tenir → un mouvement par mesure → tenir. */
const camAt = (keys: [number, number, number][], u: number) => {
  // keys : [zoom, focusX, focusY] répartis sur la scène ; interpolation logarithmique du zoom
  const n = keys.length - 1; const p = Math.min(n, Math.max(0, u * n)); const i = Math.min(n - 1, Math.floor(p)); const k = p - i;
  const e = k < 0.25 ? 0 : k > 0.85 ? 1 : (k - 0.25) / 0.6; const s = e * e * (3 - 2 * e);
  const a = keys[Math.max(0, i)], b = keys[Math.min(n, i + 1)];
  return {z: Math.exp(Math.log(a[0]) + (Math.log(b[0]) - Math.log(a[0])) * s), x: a[1] + (b[1] - a[1]) * s, y: a[2] + (b[2] - a[2]) * s};
};

export const Clip: React.FC<ClipProps> = ({title, plan, offset, audio}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  let acc = Math.round(offset * fps);
  return (
    <AbsoluteFill style={{background: '#111'}}>
      {plan.map((p, i) => {
        const from = i === 0 ? 0 : acc; const len = Math.round(p.bars * BAR * fps) + (i === 0 ? acc : 0);
        acc = (i === 0 ? 0 : acc) + len;
        const Stage = STAGES[p.stage];
        return (
          <Sequence key={i} from={from} durationInFrames={len} name={`${p.stage} (${p.bars} mesures)`}>
            <StageView Stage={Stage} plan={p} start={from / fps} offset={offset} isFirst={i === 0} />
          </Sequence>
        );
      })}
      {/* mention discrète : caricature fan-made */}
      <div style={{position: 'absolute', right: 40, top: 60, fontFamily: 'Inter, Arial', fontWeight: 700, fontSize: 26, color: '#ffffffb0', letterSpacing: 2}}>{title} · fan-made</div>
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};

const StageView: React.FC<{Stage: React.FC<{t: number; T: number}>; plan: ClipProps['plan'][number]; start: number; offset: number; isFirst: boolean}> = ({Stage, plan, start, offset}) => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const t = f / fps; const T = start + t - offset;
  const u = Math.min(1, t / (durationInFrames / fps));
  const c = camAt(plan.cam, u);
  // respiration sur le temps fort (clip musical) — reste ≥ zoom de la clé
  const z = c.z * (1 + 0.025 * pulse(T, 6) * (Math.floor(T / BEAT) % 4 === 0 ? 1 : 0.4));
  // entrée (Hukum 2) : glissement 96 px horizontal / 72 px vertical, blur ≤ 10 px, 0,42 s
  const q = Math.min(1, t / 0.42);
  const d = plan.slide === 'cut' ? 0 : (1 - q) ** 3;
  const dx = plan.slide === 'v' ? 0 : 96 * d, dy = plan.slide === 'v' ? 72 * d : 0;
  const tx = 540 - c.x * z + dx, ty = 960 - c.y * z + dy;
  return (
    <AbsoluteFill style={{overflow: 'hidden', filter: d > 0.02 ? `blur(${(10 * d).toFixed(1)}px)` : undefined}}>
      <svg width={1080} height={1920} viewBox="0 0 1080 1920">
        <g transform={`translate(${tx},${ty}) scale(${z})`}><Stage t={t} T={T} /></g>
      </svg>
    </AbsoluteFill>
  );
};
