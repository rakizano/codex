import React from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame} from 'remotion';
import {SceneProps} from '../types';
import {Chip, ease, FONT, Glass, KineticWord, Person, useT, usePop, VinylRecord, WaveformVisualizer, wordTime} from '../components/primitives';
import {Burst, Camera, DrawPath, Highlighter, Typewriter, useBeat} from '../components/fx';

/** Temps absolu du début de la scène (pour se caler sur le beat global). */
const abs = (seg: SceneProps['seg'], ep: SceneProps['ep']) => seg.start + ep.voiceOffset;

/* 1. HOOK — fête qui bat au rythme, projecteurs, verres qui trinquent ; la question fige tout. */
export const HookTitle: React.FC<SceneProps> = ({seg, p, ep}) => {
  const t = useT();
  const {pulse} = useBeat(abs(seg, ep));
  const q = wordTime(seg, 'mais');
  const freeze = ease(t, q - 0.1, q + 0.25);
  const tt = t < q ? t : q; // le temps « s'arrête » sur la question
  const beams = [0, 1, 2, 3];
  return (
    <Camera punches={[q]} shake={[q]} shots={[{at: 0, s: 1.7, x: 540, y: 1180, dur: 0.01}, {at: Math.max(0.3, wordTime(seg, 'crie') - 0.3), s: 1, dur: 0.9}]}>
      {/* projecteurs qui balaient */}
      <svg width={1080} height={1920} style={{position: 'absolute', opacity: (1 - freeze) * 0.8}}>
        {beams.map((i) => {
          const a = Math.sin(tt * 1.3 + i * 1.7) * 28;
          return <polygon key={i} points="0,0 -170,1500 170,1500" fill={i % 2 ? p.main : p.accent} opacity={0.12 + pulse * 0.12}
            transform={`translate(${150 + i * 260}, -40) rotate(${a})`} />;
        })}
      </svg>
      {/* foule qui saute au beat */}
      <svg width={1080} height={1920} style={{position: 'absolute', filter: `saturate(${1 - freeze}) brightness(${1 - freeze * 0.45})`}}>
        {[90, 260, 430, 600, 770, 940].map((x, i) => {
          const jump = (1 - freeze) * pulse * (i % 2 ? 40 : 26);
          return <Person key={i} x={x} y={1290 + (i % 2) * 50 - jump} s={1.15} color="#050b1d" arm={45 + Math.sin(tt * 7 + i) * 18 * (1 - freeze)} glass accent={p.accent} />;
        })}
        <rect x={0} y={1330} width={1080} height={600} fill="#050b1d" />
      </svg>
      {/* trinquer : éclats */}
      <Burst at={0.9} x={540} y={1050} color={p.accent} n={26} seed="cheers" />
      <div style={{position: 'absolute', top: 330, width: '100%', display: 'flex', justifyContent: 'center', opacity: 1 - freeze, transform: `scaleY(${0.8 + pulse * 0.5})`}}>
        <WaveformVisualizer p={p} color={p.accent} />
      </div>
      {(seg.kinetic ?? []).map((k, i) => {
        const at = k.at ? wordTime(seg, k.at) : 0.8 * i + 0.8;
        return t > at - 0.05 ? <KineticWord key={i} text={k.text} at={at} color={[p.ink, p.accent, p.ink, p.main][i % 4]} y={640 + i * 135} size={i === 1 ? 150 : 100} rot={i % 2 ? 3 : -3} /> : null;
      })}
      {/* « pause » : icône vinyle rayé quand la question tombe */}
      {freeze > 0 && (
        <div style={{position: 'absolute', left: 60, top: 190, opacity: freeze, transform: `rotate(${-20 + freeze * 20}deg) scale(${0.6 + freeze * 0.4})`,
          fontFamily: FONT, fontWeight: 900, fontSize: 44, color: p.bg, background: p.accent, padding: '10px 22px', borderRadius: 12}}>❚❚ pause</div>
      )}
    </Camera>
  );
};

/* 2. Titre : le bras de platine se pose, le disque démarre, le titre s'écrit lettre par lettre. */
export const ArtistTitleCard: React.FC<SceneProps> = ({seg, p, ep}) => {
  const t = useT();
  const {pulse} = useBeat(abs(seg, ep));
  const s = usePop(0.05, 14);
  const arm = ease(t, 0.2, 0.9);
  const title = ep.title.split(' (')[0];
  const sub = ep.title.includes('(') ? '(' + ep.title.split('(')[1] : '';
  return (
    <Camera punches={[0.9]} shots={[{at: 0, s: 1.65, x: 540, y: 820, dur: 0.01}, {at: 0.35, s: 1, dur: 1.0}, {at: wordTime(seg, 'produit') - 0.2, s: 1.25, x: 800, y: 1200, dur: 0.7}]}>
      {/* sillons lumineux qui rayonnent au beat */}
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        {[0, 1, 2].map((i) => <circle key={i} cx={540} cy={820} r={400 + i * 70 + pulse * 30} fill="none" stroke={p.main} strokeOpacity={0.15 - i * 0.04} strokeWidth={6} />)}
      </svg>
      <div style={{position: 'absolute', left: 540, top: 820, transform: `translate(-50%,-50%) scale(${s * (1 + pulse * 0.025)})`}}>
        <VinylRecord size={760} p={p} label={title} rpm={arm > 0.95 ? 33 : 0} />
      </div>
      {/* bras de platine */}
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={`translate(950, 420) rotate(${interpolate(arm, [0, 1], [-38, 0])})`}>
          <circle r={34} fill={p.ink} />
          <rect x={-12} y={0} width={24} height={480} rx={12} fill={p.ink} transform="rotate(28)" />
          <rect x={-215} y={410} width={70} height={36} rx={8} fill={p.accent} transform="rotate(28 0 0)" />
        </g>
      </svg>
      <div style={{position: 'absolute', top: 150, width: '100%', textAlign: 'center', fontFamily: FONT, color: p.ink}}>
        <div style={{fontSize: 60, fontWeight: 600, opacity: usePop(0.3)}}>{ep.artist}</div>
        <div style={{fontSize: 104, fontWeight: 900, color: p.main, lineHeight: 1, letterSpacing: -2}}>
          {title.split('').map((c, i) => {
            const k = ease(t, 0.5 + i * 0.04, 0.8 + i * 0.04);
            return <span key={i} style={{display: 'inline-block', transform: `translateY(${(1 - k) * 60}px) rotate(${(1 - k) * 20}deg)`, opacity: k}}>{c === ' ' ? ' ' : c}</span>;
          })}
        </div>
        <div style={{fontSize: 58, fontWeight: 700, opacity: usePop(1.2)}}>{sub}</div>
      </div>
      {(seg.chips ?? []).map((c, i) => (
        <Chip key={i} text={c.text} at={wordTime(seg, c.at) || 1 + i} p={p} x={[260, 800, 540][i % 3]} y={[1250, 1250, 1350][i % 3]} bg={[p.main, p.accent, p.ink][i % 3]} />
      ))}
    </Camera>
  );
};

/* 3. Famille : travelling avant vers une fenêtre, lumière qui vacille, bouteilles, verre qui se remplit. */
export const FamilyRoom: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  const f = useCurrentFrame();
  const fill = ease(t, wordTime(seg, 'verres') - 0.3, wordTime(seg, 'verres') + 1.6);
  const push = 1 + ease(t, 0, seg.end - seg.start + 1) * 0.12;
  const flicker = 0.16 + 0.05 * Math.sin(t * 2) + 0.04 * (random(`fl${Math.floor(f / 3)}`) > 0.9 ? 1 : 0);
  const bottles = [0, 1, 2, 3, 4];
  return (
    <Camera drift={0} shots={[{at: wordTime(seg, 'verres') - 0.4, s: 1.7, x: 900, y: 1300, dur: 0.7}, {at: wordTime(seg, 'verres') + 1.6, s: 1, dur: 0.8}]}><AbsoluteFill>
      <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '50% 45%'}}>
        <svg width={1080} height={1920} style={{position: 'absolute'}}>
          {/* maison, fenêtre éclairée */}
          <rect x={70} y={290} width={940} height={850} rx={30} fill="#1a1238" />
          <rect x={110} y={330} width={860} height={760} rx={24} fill="#f2c26b" opacity={flicker} />
          <rect x={110} y={330} width={860} height={760} rx={24} fill="none" stroke={p.ink} strokeWidth={10} />
          <line x1={540} y1={330} x2={540} y2={1090} stroke={p.ink} strokeWidth={8} />
          <line x1={110} y1={710} x2={970} y2={710} stroke={p.ink} strokeWidth={8} />
          {/* rideaux qui ondulent */}
          <path d={`M110 330 Q ${170 + Math.sin(t * 1.4) * 15} 700 ${130 + Math.sin(t) * 10} 1090 L110 1090 Z`} fill={p.accent} opacity={0.35} />
          <path d={`M970 330 Q ${910 + Math.sin(t * 1.2) * 15} 700 ${950 + Math.cos(t) * 10} 1090 L970 1090 Z`} fill={p.accent} opacity={0.35} />
          {/* silhouettes adultes qui oscillent */}
          {[250, 450, 650, 840].map((x, i) => (
            <g key={i} transform={`rotate(${Math.sin(t * 1.6 + i) * 3} ${x} 1060)`}>
              <Person x={x} y={1060} s={1.05} color="#120a26" arm={20 + Math.sin(t * 2 + i) * 15} glass accent={p.accent} />
            </g>
          ))}
          <rect x={0} y={1090} width={1080} height={40} fill={p.ink} opacity={0.7} />
          {/* bouteilles qui apparaissent sur la table */}
          {bottles.map((i) => {
            const k = ease(t, 1.2 + i * 0.35, 1.6 + i * 0.35);
            const x = 160 + i * 70;
            return (
              <g key={i} transform={`translate(${x}, ${1090 - k * 0}) scale(1, ${k})`} opacity={k}>
                <rect x={-14} y={-90} width={28} height={90} rx={6} fill={i % 2 ? '#2a6a4a' : '#6a3a1a'} />
                <rect x={-6} y={-120} width={12} height={34} rx={4} fill={i % 2 ? '#2a6a4a' : '#6a3a1a'} />
              </g>
            );
          })}
        </svg>
        <div style={{position: 'absolute', left: 900, top: 1300, transform: 'translate(-50%,-50%)'}}>
          <Glass level={0.12 + 0.82 * fill} p={p} w={170} h={240} />
        </div>
      </AbsoluteFill>
      <KineticWord text="Sa famille" at={wordTime(seg, 'famille')} color={p.ink} x={330} y={210} size={104} />
      <KineticWord text="L'alcool dans le décor" at={wordTime(seg, "l'alcool")} color={p.accent} x={420} y={1250} size={56} rot={2} />
    </AbsoluteFill></Camera>
  );
};

/* 4. Révélation : la page du magazine s'ouvre, la citation se tape, surlignage, puis la fourche se dessine. */
export const FactReveal: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  const fork = wordTime(seg, 'choisir');
  const open = ease(t, 0, 0.45);
  const k = ease(t, fork, fork + 1.0);
  const walker = ease(t, fork + 0.3, fork + 2.6);
  const ivrogne = wordTime(seg, 'ivrogne');
  return (
    <Camera punches={[ivrogne]} shots={[{at: 0.5, s: 1.22, x: 540, y: 520, dur: 0.8}, {at: fork - 0.4, s: 1, dur: 0.9}, {at: ivrogne - 0.1, s: 1.08, x: 540, y: 1050, dur: 0.6}]}>
      <div style={{position: 'absolute', left: 540, top: 470, width: 840, transform: `translate(-50%,-50%) perspective(1600px) rotateY(${(1 - open) * -45}deg) scale(${(0.6 + 0.4 * open) * (1 - 0.35 * k)}) translateY(${-k * 260}px) rotate(${Math.sin(t * 0.8) * 1.2}deg)`,
        transformOrigin: '0% 50%', padding: 50, background: p.ink, borderRadius: 28, fontFamily: FONT, color: p.bg, boxShadow: '0 30px 80px #0009'}}>
        <div style={{fontSize: 34, fontWeight: 800, letterSpacing: 6, color: p.main}}>INTERVIEW · COMPLEX · 2012</div>
        <div style={{fontSize: 62, fontWeight: 900, lineHeight: 1.08, marginTop: 18, minHeight: 140}}>
          <Highlighter at={1.8} color={p.accent + 'aa'}><Typewriter text="« buveur occasionnel… ou ivrogne »" start={0.6} cps={22} /></Highlighter>
        </div>
        <div style={{fontSize: 28, marginTop: 14, opacity: 0.7}}>traduction — voir sources.md</div>
      </div>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <DrawPath d="M 540 1700 L 540 1360" progress={k * 1.5} stroke={p.ink} width={26} len={340} />
        <DrawPath d="M 540 1360 Q 540 1160 260 1030" progress={(k - 0.3) * 1.6} stroke={p.main} width={26} len={420} />
        <DrawPath d="M 540 1360 Q 540 1160 820 1030" progress={(k - 0.3) * 1.6} stroke={p.accent} width={26} len={420} />
        {/* petit personnage qui avance puis hésite à la bifurcation */}
        {walker > 0 && (
          <g transform={`translate(540, ${1700 - walker * 330}) translate(${Math.sin(t * 5) * (walker > 0.98 ? 12 : 0)},0)`}>
            <circle cy={-70} r={20} fill={p.ink} />
            <rect x={-14} y={-50} width={28} height={50} rx={12} fill={p.ink} />
          </g>
        )}
      </svg>
      {t > fork && <KineticWord text="De temps en temps" at={fork + 0.7} color={p.main} x={300} y={960} size={38} rot={-4} />}
      {t > fork && <KineticWord text="Devenir un ivrogne" at={ivrogne} color={p.accent} x={790} y={960} size={38} rot={3} />}
    </Camera>
  );
};

/* 5. Deux voix : deux têtes de profil ; bulles qui jaillissent, la conscience s'allume. */
export const TwoVoices: React.FC<SceneProps> = ({seg, p, ep}) => {
  const t = useT();
  const {pulse} = useBeat(abs(seg, ep));
  const second = wordTime(seg, 'autre');
  const b = ease(t, second - 0.2, second + 0.6);
  const bubbles = ['encore !', 'bois !', 'allez…', 'un dernier', 'cul sec !', 'juste un'];
  const head = (x: number, flip: number, color: string, glow: number) => (
    <g transform={`translate(${x}, 1000) scale(${flip}, 1)`}>
      <circle r={150 + glow * 30} fill={color} opacity={0.15 * glow} />
      <path d="M -90 120 Q -110 -60 0 -140 Q 110 -150 120 -30 L 150 10 L 118 30 Q 120 90 60 120 L 60 200 L -90 200 Z" fill={color} />
    </g>
  );
  return (
    <Camera shots={[{at: 0.6, s: 1.15, x: 420, y: 760, dur: 0.8}, {at: second - 0.3, s: 1.15, x: 660, y: 760, dur: 0.8}, {at: second + 2.2, s: 1, dur: 0.9}]}><AbsoluteFill>
      <div style={{position: 'absolute', top: 110, width: '100%', textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 90, color: p.ink, transform: `scale(${usePop(0)})`}}>Deux voix</div>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        {head(280, 1, p.main, 1 - b * 0.6)}
        {head(800, -1, p.accent, b)}
      </svg>
      {bubbles.map((x, i) => {
        const at = 0.9 + i * 0.45;
        const s = interpolate(t - at, [0, 0.25, 0.4], [0, 1.15, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const drift = Math.max(0, t - at) * 12;
        return (
          <div key={i} style={{position: 'absolute', left: [70, 330, 120, 380, 60, 300][i], top: [330, 380, 500, 560, 660, 720][i] - drift, transform: `scale(${s}) rotate(${(i % 2 ? 4 : -4)}deg)`,
            background: p.main, color: p.bg, fontFamily: FONT, fontWeight: 900, fontSize: 44, padding: '14px 26px', borderRadius: 36, opacity: 1 - b * 0.5}}>{x}</div>
        );
      })}
      <div style={{position: 'absolute', left: 600, top: 640, whiteSpace: 'nowrap', opacity: b, transform: `translateY(${(1 - b) * 60}px)`, background: p.accent, color: p.bg,
        fontFamily: FONT, fontWeight: 900, fontSize: 46, padding: '22px 28px', borderRadius: 30, boxShadow: `0 0 ${40 + pulse * 40}px ${p.accent}`}}>
        « fais gaffe… »
      </div>
      <div style={{position: 'absolute', top: 810, left: 160, fontFamily: FONT, color: p.main, fontSize: 38, fontWeight: 900, opacity: 1 - b * 0.5}}>Les potes</div>
      <div style={{position: 'absolute', top: 810, left: 620, fontFamily: FONT, color: p.accent, fontSize: 38, fontWeight: 900, opacity: 0.3 + b * 0.7}}>La conscience</div>
    </AbsoluteFill></Camera>
  );
};

/* 6. Piscine d'alcool : plongeon en arc, gerbe, bulles, le liquide monte et engloutit le cadre. */
export const PoolDive: React.FC<SceneProps> = ({seg, p}) => {
  const t = useT();
  const dive = wordTime(seg, 'plonger');
  const drown = wordTime(seg, 'noyer');
  const fall = ease(t, dive - 0.3, dive + 0.9);
  const splashT = dive + 0.9;
  const level = ease(t, drown - 0.3, drown + 1.6);
  const arcX = 540 + Math.sin(fall * Math.PI) * 120;
  const arcY = 640 - Math.sin(fall * Math.PI) * 160 + fall * 420;
  return (
    <Camera punches={[splashT, drown]} shake={[splashT]} shots={[{at: dive - 0.7, s: 1.18, x: 540, y: 700, dur: 0.6}, {at: dive + 0.5, s: 1, dur: 0.5}]}>
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <rect x={120} y={700} width={840} height={900} rx={40} fill={p.ink} opacity={0.14} />
        <rect x={150} y={730} width={780} height={840} rx={30} fill={p.accent} opacity={0.78} />
        {Array.from({length: 6}).map((_, i) => (
          <path key={i} d={`M 170 ${800 + i * 130} q 95 ${Math.sin(t * 2 + i) * 22} 190 0 t 190 0 t 190 0 t 190 0`} stroke="#fff" strokeOpacity={0.35} strokeWidth={6} fill="none" />
        ))}
        {/* reflets lumineux */}
        {Array.from({length: 10}).map((_, i) => (
          <ellipse key={i} cx={200 + ((i * 97 + t * 40) % 700)} cy={760 + ((i * 173) % 780)} rx={30} ry={6} fill="#fff" opacity={0.18 + 0.12 * Math.sin(t * 3 + i)} />
        ))}
        <rect x={430} y={650} width={220} height={26} rx={10} fill={p.ink} transform={`rotate(${t < dive ? Math.sin(t * 9) * 2 : 0} 430 663)`} />
        <g transform={`translate(${arcX}, ${arcY}) rotate(${fall * 200})`} opacity={1 - ease(t, splashT - 0.05, splashT + 0.1)}>
          <g transform="scale(1.8)"><circle cx={0} cy={-60} r={24} fill="#060d22" /><rect x={-20} y={-36} width={40} height={90} rx={18} fill="#060d22" /></g>
        </g>
        {[0, 1, 2].map((i) => {
          const k = ease(t, splashT + i * 0.18, splashT + 1.3 + i * 0.18);
          return <circle key={i} cx={560} cy={1060} r={40 + k * 320} fill="none" stroke="#fff" strokeWidth={8} opacity={(1 - k) * (k > 0 ? 1 : 0)} />;
        })}
        {/* bulles qui remontent après le plongeon */}
        {t > splashT && Array.from({length: 14}).map((_, i) => {
          const life = (t - splashT - i * 0.12);
          if (life < 0) return null;
          return <circle key={i} cx={540 + Math.sin(i * 2.3 + life * 4) * 60} cy={1300 - life * 260} r={6 + (i % 4) * 4} fill="none" stroke="#fff" strokeWidth={3} opacity={Math.max(0, 1 - life / 2)} />;
        })}
        <rect x={0} y={1920 - level * 1920} width={1080} height={1920} fill={p.accent} opacity={0.92 * level} />
        <path d={`M 0 ${1920 - level * 1920} q 135 -30 270 0 t 270 0 t 270 0 t 270 0`} fill={p.accent} opacity={level} transform={`translate(${Math.sin(t * 2) * 30},0)`} />
      </svg>
      <Burst at={splashT} x={560} y={1040} color="#ffffff" n={30} spread={620} seed="splash" gravity={1400} />
      <KineticWord text="Pas d'eau" at={wordTime(seg, 'pas')} color={p.ink} x={340} y={220} size={100} />
      <KineticWord text="de l'alcool" at={wordTime(seg, "d'alcool") || wordTime(seg, 'alcool')} color={p.main} x={640} y={350} size={118} rot={3} />
      {t > drown && <KineticWord text="S'y noyer" at={drown} color={p.bg} y={960} size={150} />}
    </Camera>
  );
};

/* 7. Contraste : un fil TikTok qui défile (cœurs, verres) vs ce que dit le morceau. */
export const TikTokUsageContrast: React.FC<SceneProps> = ({seg, p, ep}) => {
  const t = useT();
  const {pulse} = useBeat(abs(seg, ep));
  const right = wordTime(seg, 'mais');
  const split = ease(t, right - 0.2, right + 0.6);
  const items = [['🧠', 'pression du groupe'], ['🍸', 'tentation'], ['🔁', 'ce qu’on reproduit']];
  const scroll = (t * 160) % 260;
  return (
    <Camera punches={[right]} shots={[{at: 0, s: 1.45, x: 540, y: 730, dur: 0.01}, {at: right - 0.35, s: 1, dur: 0.8}]}>
      <AbsoluteFill style={{background: p.bg}} />
      <div style={{position: 'absolute', left: 0, width: 1080 - split * 540, top: 0, height: 1920, background: p.accent}} />
      <div style={{position: 'absolute', left: 0, width: 1080 - split * 540, top: 260, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 64, color: p.bg}}>En soirée</div>
      {/* téléphone + fil qui défile */}
      <div style={{position: 'absolute', left: (1080 - split * 540) / 2 - 160, top: 420, width: 320, height: 620, borderRadius: 44, background: p.bg, overflow: 'hidden', transform: `scale(${1 + pulse * 0.02})`}}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{position: 'absolute', left: 16, top: 16 + i * 260 - scroll, width: 288, height: 240, borderRadius: 22, background: i % 2 ? p.main : '#1d2f5a', overflow: 'hidden'}}>
            <svg width={288} height={240}>{[0, 1, 2].map((j) => <Person key={j} x={70 + j * 75} y={215} s={0.42} color={p.bg} arm={40 + Math.sin(t * 7 + j + i) * 20} glass accent={p.accent} />)}</svg>
          </div>
        ))}
        {[0, 1, 2, 3, 4].map((i) => {
          const life = ((t * 1.3 + i * 0.37) % 1.6);
          return <div key={i} style={{position: 'absolute', right: 18 + Math.sin(life * 6 + i) * 10, bottom: 40 + life * 260, fontSize: 40, opacity: 1 - life / 1.6}}>❤️</div>;
        })}
      </div>
      <div style={{position: 'absolute', left: 30, top: 1080, width: 480, fontFamily: FONT, fontSize: 26, color: p.bg, opacity: 0.85}}>usage observé à confirmer par relevé (tiktok-usage.md)</div>
      <div style={{position: 'absolute', left: 590, top: 260, width: 460, textAlign: 'center', fontFamily: FONT, fontWeight: 900, fontSize: 56, color: p.ink, opacity: split}}>Dans le morceau</div>
      {items.map(([ic, x], i) => {
        const at = right + 0.8 + i * 1.0;
        const s = ease(t, at, at + 0.35);
        return (
          <div key={i} style={{position: 'absolute', left: 590, top: 470 + i * 200, width: 440, display: 'flex', alignItems: 'center', gap: 18, opacity: s, transform: `translateX(${(1 - s) * 80}px) scale(${0.9 + 0.1 * s})`}}>
            <div style={{fontSize: 64}}>{ic}</div>
            <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 46, color: i === 1 ? p.accent : p.ink, lineHeight: 1.05}}>{x}</div>
          </div>
        );
      })}
    </Camera>
  );
};

/* 8. Question finale : le vinyle accélère au beat, bulles de commentaires qui surgissent. */
export const EndQuestion: React.FC<SceneProps> = ({seg, p, ep}) => {
  const t = useT();
  const {pulse} = useBeat(abs(seg, ep));
  const c = wordTime(seg, 'commentaire');
  return (
    <Camera drift={0.04} shots={[{at: c - 0.3, s: 1.3, x: 540, y: 820, dur: 0.9}]}><AbsoluteFill>
      <div style={{position: 'absolute', left: 540, top: 1340, transform: `translate(-50%,-50%) scale(${0.72 + pulse * 0.04})`, opacity: 0.95}}>
        <VinylRecord size={700} p={p} label="L'ENVERS DU SON" rpm={20 + t * 6} />
      </div>
      <KineticWord text="Et maintenant," at={0.2} color={p.ink} y={340} size={90} />
      <KineticWord text="tu l'écoutes" at={0.9} color={p.main} y={480} size={120} rot={2} />
      <KineticWord text="pareil ?" at={1.6} color={p.accent} y={640} size={160} />
      {['🎧', '💬', '🔥', '🎤'].map((e, i) => {
        const at = c + i * 0.25;
        const s = ease(t, at, at + 0.3);
        return <div key={i} style={{position: 'absolute', left: [150, 820, 240, 760][i], top: [1000, 1020, 1640, 1620][i] - Math.max(0, t - at) * 15, fontSize: 90, transform: `scale(${s})`}}>{e}</div>;
      })}
      <div style={{position: 'absolute', left: 540, top: 840, transform: `translate(-50%,-50%) scale(${ease(t, c, c + 0.35) * (1 + pulse * 0.05)})`, background: p.ink, color: p.bg,
        fontFamily: FONT, fontWeight: 900, fontSize: 46, padding: '18px 34px', borderRadius: 999, whiteSpace: 'nowrap'}}>ton morceau en commentaire ↓</div>
    </AbsoluteFill></Camera>
  );
};

export const SCENES: Record<string, React.FC<SceneProps>> = {HookTitle, ArtistTitleCard, FamilyRoom, FactReveal, TwoVoices, PoolDive, TikTokUsageContrast, EndQuestion};
