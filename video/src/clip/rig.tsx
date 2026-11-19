/**
 * Rig de personnage « kartun panggung » (Bang Motion, Hukum 4/5) : sendi hiérarchiques,
 * transformations écrites à la main (fonctions pures du temps), aplats sans contour.
 * Pieds à y=0 ; bassin à -214 ; épaules à -340 ; tête au-dessus du cou.
 */
import React from 'react';

export type Look = {
  skin: string; hair: string; hairStyle: 'braids' | 'short' | 'bald' | 'afro' | 'cap' | 'bun' | 'puffs';
  top: string; bottom: string; shoes: string; beard?: boolean; cap?: string; glow?: string; sleeve?: string;
};
export type Pose = {
  lean?: number; bob?: number;
  thighL?: number; shinL?: number; thighR?: number; shinR?: number;
  armL?: number; foreL?: number; armR?: number; foreR?: number;
  head?: number; mouth?: 'smile' | 'flat' | 'open' | 'worried' | 'o'; eyes?: 'open' | 'closed' | 'side';
  cupR?: string; cupL?: string; sit?: boolean;
};

export const BPM = 74;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
/** pulsation 0..1 qui retombe après chaque temps (t en secondes depuis le 1er temps). */
export const pulse = (t: number, k = 7) => Math.exp(-((((t % BEAT) + BEAT) % BEAT)) * k);
/** hochement de tête de clip : descend sur le temps. */
export const nod = (t: number, amp = 6) => amp * pulse(t, 6);
export const blinkAt = (t: number, phase: number) => ((t + phase) % 3.5) < 0.13;
export const wave = (t: number, period: number, amp: number, ph = 0) => Math.sin((t / period) * Math.PI * 2 + ph) * amp;
export const walk = (t: number, speed = 8) => Math.sin(t * speed);

const Limb: React.FC<{len: number; w: number; color: string}> = ({len, w, color}) => (
  <rect x={-w / 2} y={-6} width={w} height={len + 12} rx={w / 2} fill={color} />
);

const Head: React.FC<{look: Look; pose: Pose; blink: boolean}> = ({look, pose, blink}) => {
  const {skin, hair, hairStyle} = look;
  const eyeY = -58, eyes = blink || pose.eyes === 'closed';
  const ex = pose.eyes === 'side' ? 6 : 0;
  const mouth = pose.mouth ?? 'smile';
  return (
    <g>
      {/* cou */}
      <rect x={-13} y={-24} width={26} height={30} fill={skin} />
      {hairStyle === 'afro' && <circle cx={0} cy={-66} r={68} fill={hair} />}
      {hairStyle === 'puffs' && <><circle cx={-50} cy={-104} r={26} fill={hair} /><circle cx={50} cy={-104} r={26} fill={hair} /></>}
      {/* visage */}
      <ellipse cx={0} cy={-60} rx={46} ry={54} fill={skin} />
      <ellipse cx={-46} cy={-58} rx={8} ry={12} fill={skin} /><ellipse cx={46} cy={-58} rx={8} ry={12} fill={skin} />
      {/* cheveux : une seule silhouette */}
      {hairStyle === 'braids' && (
        <g fill={hair}>
          <path d="M-48 -70 C-52 -120 -20 -122 0 -122 C20 -122 52 -120 48 -70 C40 -96 -40 -96 -48 -70 Z" />
          {[-38, -22, -6, 10, 26, 40].map((x, i) => <rect key={i} x={x - 5} y={-120} width={10} height={36} rx={5} transform={`rotate(${(x / 40) * 10} ${x} -110)`} />)}
        </g>
      )}
      {hairStyle === 'short' && <path d="M-47 -66 C-50 -118 50 -118 47 -66 C38 -94 -38 -94 -47 -66 Z" fill={hair} />}
      {hairStyle === 'bun' && <><path d="M-47 -62 C-50 -118 50 -118 47 -62 C38 -96 -38 -96 -47 -62 Z" fill={hair} /><circle cx={0} cy={-124} r={22} fill={hair} /></>}
      {hairStyle === 'cap' && (<g><path d="M-49 -70 C-49 -122 49 -122 49 -70 Z" fill={look.cap ?? hair} /><rect x={-6} y={-78} width={74} height={14} rx={7} fill={look.cap ?? hair} /></g>)}
      {look.beard && <path d="M-42 -50 C-40 -6 40 -6 42 -50 C30 -26 -30 -26 -42 -50 Z" fill={hair} opacity={0.9} />}
      {/* yeux : deux points (kedip = trait) */}
      {eyes ? (
        <g stroke="#1b1b1b" strokeWidth={4} strokeLinecap="round"><line x1={-22 + ex} y1={eyeY} x2={-10 + ex} y2={eyeY} /><line x1={10 + ex} y1={eyeY} x2={22 + ex} y2={eyeY} /></g>
      ) : (<g fill="#1b1b1b"><circle cx={-16 + ex} cy={eyeY} r={5.5} /><circle cx={16 + ex} cy={eyeY} r={5.5} /></g>)}
      <g stroke="#1b1b1b" strokeWidth={3.5} strokeLinecap="round" fill="none">
        <line x1={-24} y1={-74} x2={-10} y2={pose.mouth === 'worried' ? -78 : -76} /><line x1={10} y1={pose.mouth === 'worried' ? -78 : -76} x2={24} y2={-74} />
      </g>
      {mouth === 'smile' && <path d="M-12 -34 Q0 -26 12 -34" stroke="#1b1b1b" strokeWidth={4} fill="none" strokeLinecap="round" />}
      {mouth === 'flat' && <line x1={-10} y1={-32} x2={10} y2={-32} stroke="#1b1b1b" strokeWidth={4} strokeLinecap="round" />}
      {mouth === 'worried' && <path d="M-12 -28 Q0 -36 12 -28" stroke="#1b1b1b" strokeWidth={4} fill="none" strokeLinecap="round" />}
      {mouth === 'open' && <ellipse cx={0} cy={-31} rx={13} ry={9} fill="#5a1f1f" />}
      {mouth === 'o' && <circle cx={0} cy={-31} r={7} fill="#5a1f1f" />}
    </g>
  );
};

const Cup: React.FC<{color: string}> = ({color}) => (
  <g transform="translate(0,-8)"><path d="M-16 -40 L16 -40 L12 6 L-12 6 Z" fill="#fff" opacity={0.9} /><path d="M-14 -24 L14 -24 L12 6 L-12 6 Z" fill={color} /></g>
);

/** Personnage articulé. x,y = pieds ; s = échelle ; flip = regarde à gauche. */
export const Char: React.FC<{x: number; y: number; s?: number; flip?: boolean; look: Look; pose?: Pose; blink?: boolean; shadow?: boolean}> = ({x, y, s = 1, flip, look, pose = {}, blink = false, shadow = true}) => {
  const P = {thighL: 0, shinL: 0, thighR: 0, shinR: 0, armL: 8, foreL: -6, armR: -8, foreR: 6, head: 0, lean: 0, bob: 0, ...pose};
  const sit = !!P.sit;
  const leg = (side: 1 | -1, th: number, sh: number) => (
    <g transform={`translate(${side * 24},-214) rotate(${th})`}>
      <Limb len={102} w={40} color={look.bottom} />
      <g transform={`translate(0,102) rotate(${sh})`}>
        <Limb len={96} w={34} color={look.bottom} />
        <g transform="translate(0,96)"><rect x={-20} y={-6} width={50} height={22} rx={10} fill={look.shoes} /></g>
      </g>
    </g>
  );
  const arm = (side: 1 | -1, a: number, f: number, cup?: string) => (
    <g transform={`translate(${side * 50},-338) rotate(${a})`}>
      <Limb len={78} w={30} color={look.sleeve ?? look.top} />
      <g transform={`translate(0,78) rotate(${f})`}>
        <Limb len={74} w={24} color={look.skin} />
        <g transform="translate(0,78)"><circle r={15} fill={look.skin} />{cup && <Cup color={cup} />}</g>
      </g>
    </g>
  );
  return (
    <g transform={`translate(${x},${y}) scale(${flip ? -s : s},${s})`}>
      {shadow && <ellipse cx={0} cy={4} rx={78} ry={16} fill="#000" opacity={0.13} />}
      {look.glow && <ellipse cx={0} cy={-230} rx={140} ry={280} fill={look.glow} opacity={0.35} />}
      <g transform={`translate(0,${-P.bob}) rotate(${P.lean} 0 -214)`}>
        {arm(1, P.armR, P.foreR, P.cupR)}
        {sit ? <>{leg(-1, -82, 88)}{leg(1, -78, 84)}</> : <>{leg(-1, P.thighL, P.shinL)}{leg(1, P.thighR, P.shinR)}</>}
        {/* torse */}
        <path d="M-56 -350 C-60 -260 -50 -214 -44 -200 L44 -200 C50 -214 60 -260 56 -350 C30 -366 -30 -366 -56 -350 Z" fill={look.top} />
        <g transform={`translate(0,-356) rotate(${P.head})`}><Head look={look} pose={P} blink={blink} /></g>
        {arm(-1, P.armL, P.foreL, P.cupL)}
      </g>
    </g>
  );
};

/* ---------- distribution des rôles (personnages originaux ; le héros est une caricature fan-made) ---------- */
export const LOOKS: Record<string, Look> = {
  // héros : inspiré de l'allure de l'artiste en 2012 (tresses, barbe légère, t-shirt blanc) — caricature, non officiel
  K: {skin: '#7a4a2e', hair: '#1e140e', hairStyle: 'braids', top: '#f4f1ea', bottom: '#2b2f3a', shoes: '#e9e6df', beard: true},
  Kkid: {skin: '#7a4a2e', hair: '#1e140e', hairStyle: 'short', top: '#e0714f', bottom: '#345867', shoes: '#f4f1ea'},
  Kglow: {skin: '#9a6a4a', hair: '#2a1d14', hairStyle: 'braids', top: '#fff7d6', bottom: '#d9c27a', shoes: '#fff7d6', beard: true, glow: '#fff1b0'},
  uncle: {skin: '#6b3f27', hair: '#1a1210', hairStyle: 'cap', cap: '#237c80', top: '#345867', bottom: '#1f2a33', shoes: '#111', beard: true},
  aunt: {skin: '#8a5636', hair: '#24170f', hairStyle: 'bun', top: '#e0714f', bottom: '#5b2d4f', shoes: '#111'},
  grandpa: {skin: '#5e3a24', hair: '#d8d2c8', hairStyle: 'short', top: '#8b5e3c', bottom: '#3a3a3a', shoes: '#111', beard: true},
  friend1: {skin: '#5a3420', hair: '#120c08', hairStyle: 'cap', cap: '#f4bc52', top: '#237c80', bottom: '#20252e', shoes: '#f4f1ea'},
  friend2: {skin: '#8c5a3a', hair: '#1a1009', hairStyle: 'afro', top: '#c9466b', bottom: '#2b2f3a', shoes: '#111'},
  friend3: {skin: '#6e4329', hair: '#0f0a07', hairStyle: 'puffs', top: '#8dd3c3', bottom: '#345867', shoes: '#f4f1ea'},
  friend4: {skin: '#a06a46', hair: '#2a1a10', hairStyle: 'short', top: '#f4bc52', bottom: '#2b2f3a', shoes: '#111'},
};
