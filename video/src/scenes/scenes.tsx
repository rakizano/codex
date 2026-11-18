import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {SceneProps} from '../types';
import {Chip, ease, FONT, Glass, KineticWord, Person, useT, usePop, VinylRecord, WaveformVisualizer, wordTime} from '../components/primitives';

const Bg: React.FC<{p: SceneProps['p']; tint?: string}> = ({p, tint}) => {
  const t = useT();
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% ${35 + Math.sin(t * 0.6) * 5}%, ${tint ?? p.main}33 0%, ${p.bg} 60%)`}} />
  );
};

/* 1. HOOK — verres levés, refrain crié, puis la question. */
export const HookTitle: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  const q = wordTime(seg, 'mais');
  const raise = Math.sin(t * 6) * 8;
  const dim = ease(t, q, q + 0.6);
  return (
    <AbsoluteFill>
      <Bg p={p} tint={p.accent} />
      <svg width={1080} height={1920} style={{position: 'absolute', opacity: 1 - dim * 0.65}}>
        {[160, 360, 560, 760, 940].map((x, i) => (
          <Person key={i} x={x} y={1250 + (i % 2) * 40} s={1.1} color="#060d22" arm={40 + raise * (i % 2 ? 1 : -1)} glass accent={p.accent} />
        ))}
      </svg>
      <div style={{position: 'absolute', top: 360, width: '100%', display: 'flex', justifyContent: 'center', opacity: 1 - dim}}>
        <WaveformVisualizer p={p} color={p.accent} />
      </div>
      <KineticWord text="On le crie" at={0.8} color={p.ink} y={700} size={110} />
      <KineticWord text="en soirée" at={1.6} color={p.accent} y={830} size={140} rot={3} />
      {t > q && <KineticWord text="mais tu sais" at={q} color={p.ink} y={1000} size={96} />}
      {t > q && <KineticWord text="ce qu'il raconte ?" at={q + 0.5} color={p.main} y={1110} size={96} rot={2} />}
    </AbsoluteFill>
  );
};

/* 2. Titre + artiste sur un vinyle. */
export const ArtistTitleCard: React.FC<SceneProps> = ({seg, p, ep}) => {
  const s = usePop(0.1, 14);
  return (
    <AbsoluteFill>
      <Bg p={p} />
      <div style={{position: 'absolute', left: 540, top: 820, transform: `translate(-50%,-50%) scale(${s})`}}>
        <VinylRecord size={760} p={p} label="SWIMMING POOLS" />
      </div>
      <div style={{position: 'absolute', top: 180, width: '100%', textAlign: 'center', fontFamily: FONT, color: p.ink}}>
        <div style={{fontSize: 64, fontWeight: 600, opacity: usePop(0.3)}}>{ep.artist}</div>
        <div style={{fontSize: 108, fontWeight: 900, color: p.main, lineHeight: 1, transform: `scale(${usePop(0.6)})`}}>SWIMMING POOLS</div>
        <div style={{fontSize: 60, fontWeight: 700, opacity: usePop(0.9)}}>(Drank)</div>
      </div>
      <Chip text="2012" at={wordTime(seg, '2012') || 2} p={p} x={260} y={1220} />
      <Chip text="good kid, m.A.A.d city" at={wordTime(seg, 'good') || 3.5} p={p} x={540} y={1320} bg={p.ink} />
      <Chip text="prod. T-Minus" at={wordTime(seg, 'produit')} p={p} x={800} y={1220} bg={p.accent} />
    </AbsoluteFill>
  );
};

/* 3. Environnement familial : une fenêtre éclairée, des adultes, des verres qui se remplissent. */
export const FamilyRoom: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  const fill = ease(t, wordTime(seg, 'verres') - 0.5, seg.end - seg.start);
  return (
    <AbsoluteFill>
      <Bg p={p} tint="#7b4dff" />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <rect x={110} y={330} width={860} height={760} rx={30} fill="#f2c26b" opacity={0.16 + 0.04 * Math.sin(t * 2)} />
        <rect x={110} y={330} width={860} height={760} rx={30} fill="none" stroke={p.ink} strokeWidth={10} />
        <line x1={540} y1={330} x2={540} y2={1090} stroke={p.ink} strokeWidth={8} />
        <line x1={110} y1={710} x2={970} y2={710} stroke={p.ink} strokeWidth={8} />
        {[260, 460, 660, 840].map((x, i) => (
          <Person key={i} x={x} y={1060} s={1.05} color="#1a1033" arm={20 + Math.sin(t * 2 + i) * 15} glass accent={p.accent} />
        ))}
        <rect x={0} y={1090} width={1080} height={30} fill={p.ink} opacity={0.6} />
      </svg>
      <div style={{position: 'absolute', left: 940, top: 1330, transform: 'translate(-50%,-50%)'}}>
        <Glass level={0.15 + 0.8 * fill} p={p} w={170} h={240} />
      </div>
      <KineticWord text="sa famille" at={wordTime(seg, 'famille')} color={p.ink} y={230} size={100} />
      <KineticWord text="l'alcool dans le décor" at={wordTime(seg, "l'alcool")} color={p.accent} x={420} y={1250} size={56} rot={2} />
    </AbsoluteFill>
  );
};

/* 4. Révélation : l'interview, puis la bifurcation. */
export const FactReveal: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  const fork = wordTime(seg, 'choisir');
  const card = usePop(0.2, 13);
  const k = ease(t, fork, fork + 1.2);
  return (
    <AbsoluteFill>
      <Bg p={p} />
      <div style={{position: 'absolute', left: 540, top: 470, transform: `translate(-50%,-50%) scale(${card * (1 - 0.35 * k)}) translateY(${-k * 260}px)`,
        width: 820, padding: 50, background: p.ink, borderRadius: 28, fontFamily: FONT, color: p.bg, boxShadow: '0 30px 80px #0008'}}>
        <div style={{fontSize: 36, fontWeight: 800, letterSpacing: 6, color: p.main}}>INTERVIEW · COMPLEX</div>
        <div style={{fontSize: 64, fontWeight: 900, lineHeight: 1.05, marginTop: 18}}>« son propre rapport à l'alcool »</div>
        <div style={{fontSize: 30, marginTop: 18, opacity: 0.7}}>paraphrase — voir sources.md</div>
      </div>
      <svg width={1080} height={1920} style={{position: 'absolute', opacity: k}}>
        <path d={`M 540 1650 L 540 ${1650 - 300 * k}`} stroke={p.ink} strokeWidth={26} strokeLinecap="round" />
        <path d={`M 540 1350 Q 540 1150 ${540 - 280 * k} ${1350 - 330 * k}`} stroke={p.main} strokeWidth={26} fill="none" strokeLinecap="round" />
        <path d={`M 540 1350 Q 540 1150 ${540 + 280 * k} ${1350 - 330 * k}`} stroke={p.accent} strokeWidth={26} fill="none" strokeLinecap="round" />
      </svg>
      {t > fork && <KineticWord text="de temps en temps" at={fork + 0.8} color={p.main} x={300} y={880} size={46} rot={-4} />}
      {t > fork && <KineticWord text="se laisser entraîner" at={wordTime(seg, 'entraîner')} color={p.accent} x={770} y={1010} size={46} rot={3} />}
    </AbsoluteFill>
  );
};

/* 5. Deux voix : la bande des potes vs la conscience. */
export const TwoVoices: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  const second = wordTime(seg, 'autre');
  const a = ease(t, 0.8, 1.6);
  const b = ease(t, second - 0.3, second + 0.6);
  const bubble = (txt: string, i: number, at: number) => {
    const s = interpolate(t - at - i * 0.35, [0, 0.4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
    return (
      <div key={i} style={{position: 'absolute', left: [90, 560, 200, 640][i], top: [280, 300, 430, 450][i], transform: `scale(${s})`, background: p.main, color: p.bg,
        fontFamily: FONT, fontWeight: 900, fontSize: 48, padding: '16px 30px', borderRadius: 40}}>{txt}</div>
    );
  };
  return (
    <AbsoluteFill>
      <Bg p={p} />
      <div style={{position: 'absolute', top: 120, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 90, color: p.ink}}>
        <span style={{opacity: usePop(0)}}>DEUX VOIX</span>
      </div>
      {['encore !', 'bois !', 'allez…', 'un dernier'].map((x, i) => bubble(x, i, 1.2))}
      <div style={{position: 'absolute', top: 640, left: 90, opacity: a}}>
        <div style={{fontFamily: FONT, color: p.main, fontSize: 40, fontWeight: 800, marginBottom: 10}}>LES POTES</div>
        <WaveformVisualizer p={p} width={900} height={220} bars={40} />
      </div>
      <div style={{position: 'absolute', top: 1060, left: 90, opacity: b, transform: `translateY(${(1 - b) * 80}px)`}}>
        <div style={{fontFamily: FONT, color: p.accent, fontSize: 40, fontWeight: 800, marginBottom: 10}}>LA CONSCIENCE · voix plus grave</div>
        <WaveformVisualizer p={p} width={900} height={120} bars={20} color={p.accent} />
      </div>
    </AbsoluteFill>
  );
};

/* 6. La piscine d'alcool : vue de dessus, plongeon, montée du liquide. */
export const PoolDive: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  const dive = wordTime(seg, 'plonger');
  const drown = wordTime(seg, 'noyer');
  const fall = ease(t, dive - 0.2, dive + 1.0);
  const level = ease(t, drown - 0.4, drown + 1.6);
  return (
    <AbsoluteFill>
      <Bg p={p} />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <rect x={120} y={700} width={840} height={900} rx={40} fill={p.ink} opacity={0.12} />
        <rect x={150} y={730} width={780} height={840} rx={30} fill={p.accent} opacity={0.75} />
        {Array.from({length: 6}).map((_, i) => (
          <path key={i} d={`M 170 ${800 + i * 130} q 95 ${Math.sin(t * 2 + i) * 20} 190 0 t 190 0 t 190 0 t 190 0`} stroke="#fff" strokeOpacity={0.35} strokeWidth={6} fill="none" />
        ))}
        {/* plongeoir */}
        <rect x={430} y={560} width={220} height={26} rx={10} fill={p.ink} />
        {/* plongeur */}
        <g transform={`translate(540, ${520 + fall * 520}) rotate(${fall * 180})`} opacity={1 - ease(t, dive + 0.9, dive + 1.2)}>
          <circle cx={0} cy={-60} r={24} fill="#060d22" />
          <rect x={-20} y={-36} width={40} height={90} rx={18} fill="#060d22" />
        </g>
        {/* cercles d'impact */}
        {[0, 1, 2].map((i) => {
          const k = ease(t, dive + 1 + i * 0.2, dive + 2.2 + i * 0.2);
          return <circle key={i} cx={540} cy={1050} r={40 + k * 300} fill="none" stroke="#fff" strokeWidth={8} opacity={(1 - k) * (k > 0 ? 1 : 0)} />;
        })}
        {/* le liquide monte et envahit le cadre */}
        <rect x={0} y={1920 - level * 1920} width={1080} height={1920} fill={p.accent} opacity={0.9 * level} />
      </svg>
      <KineticWord text="pas d'eau" at={wordTime(seg, 'pas')} color={p.ink} y={220} size={100} />
      <KineticWord text="de l'alcool" at={wordTime(seg, "d'alcool") || wordTime(seg, 'alcool')} color={p.main} y={340} size={115} rot={3} />
      {t > drown && <KineticWord text="s'y noyer" at={drown} color={p.bg} y={960} size={150} />}
    </AbsoluteFill>
  );
};

/* 7. Contraste : ce qu'on en fait / ce que dit le morceau. */
export const TikTokUsageContrast: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  const right = wordTime(seg, 'mais');
  const split = ease(t, right - 0.2, right + 0.6);
  const items = ['pression du groupe', 'tentation', 'ce qu’on reproduit'];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{background: `linear-gradient(90deg, ${p.accent} ${50 - split * 0}%, ${p.bg} ${50}%)`}} />
      <div style={{position: 'absolute', left: 0, width: 540, top: 0, height: 1920, background: p.accent, transform: `translateX(${-(1 - usePop(0)) * 540}px)`}} />
      <div style={{position: 'absolute', left: 540, width: 540, top: 0, height: 1920, background: p.bg, opacity: split}} />
      <div style={{position: 'absolute', left: 270, top: 300, transform: 'translateX(-50%)', fontFamily: FONT, fontWeight: 900, fontSize: 64, color: p.bg, textAlign: 'center'}}>EN SOIRÉE</div>
      <svg width={540} height={900} style={{position: 'absolute', left: 0, top: 500}}>
        <rect x={110} y={20} width={320} height={600} rx={44} fill={p.bg} />
        <rect x={130} y={60} width={280} height={520} rx={24} fill={p.main} opacity={0.4} />
        {[0, 1, 2].map((i) => <Person key={i} x={190 + i * 80} y={460} s={0.45} color={p.bg} arm={40 + Math.sin(t * 6 + i) * 20} glass accent={p.accent} />)}
      </svg>
      <div style={{position: 'absolute', left: 810, top: 300, transform: 'translateX(-50%)', fontFamily: FONT, fontWeight: 900, fontSize: 58, color: p.ink, textAlign: 'center', opacity: split}}>DANS LE<br />MORCEAU</div>
      {items.map((x, i) => {
        const at = right + 0.8 + i * 1.1;
        const s = ease(t, at, at + 0.4);
        return <div key={i} style={{position: 'absolute', left: 600, top: 620 + i * 190, width: 420, fontFamily: FONT, fontWeight: 800, fontSize: 50, color: i === 1 ? p.accent : p.ink,
          opacity: s, transform: `translateX(${(1 - s) * 60}px)`, borderLeft: `10px solid ${p.main}`, paddingLeft: 24}}>{x}</div>;
      })}
      <div style={{position: 'absolute', left: 40, top: 1380, width: 460, fontFamily: FONT, fontSize: 30, color: p.bg, opacity: 0.85}}>
        usage observé à confirmer par relevé (tiktok-usage.md)
      </div>
    </AbsoluteFill>
  );
};

/* 8. Question finale. */
export const EndQuestion: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  return (
    <AbsoluteFill>
      <Bg p={p} tint={p.accent} />
      <div style={{position: 'absolute', left: 540, top: 1350, transform: `translate(-50%,-50%) scale(${0.7 + 0.05 * Math.sin(t * 2)})`, opacity: 0.9}}>
        <VinylRecord size={700} p={p} label="L'ENVERS DU SON" rpm={20} />
      </div>
      <KineticWord text="et maintenant," at={0.2} color={p.ink} y={360} size={90} />
      <KineticWord text="tu l'écoutes" at={0.9} color={p.main} y={500} size={120} rot={2} />
      <KineticWord text="pareil ?" at={1.6} color={p.accent} y={650} size={150} />
      <KineticWord text="ton morceau en commentaire ↓" at={wordTime(seg, 'commentaire')} color={p.ink} y={830} size={50} rot={0} weight={700} />
    </AbsoluteFill>
  );
};

export const SCENES: Record<string, React.FC<SceneProps>> = {HookTitle, ArtistTitleCard, FamilyRoom, FactReveal, TwoVoices, PoolDive, TikTokUsageContrast, EndQuestion};
