/**
 * Clip « Swimming Pools » — 6 panggung (Bang Motion kartun panggung) synchronisés sur 74 BPM.
 * Chaque panggung : ≥ 10 éléments animés, personnages articulés, aplats sans contour, zéro sous-titre
 * (seul le texte diégétique : enseignes, plaques). Le sens suit le récit du morceau (paraphrasé, aucune parole affichée).
 */
import React from 'react';
import {Char, LOOKS, BEAT, BAR, pulse, nod, blinkAt, wave, walk} from './rig';

export type StageProps = {t: number; T: number}; // t = temps local (s), T = temps global depuis le 1er temps

const Sky: React.FC<{a: string; b: string; h?: number}> = ({a, b, h = 1920}) => (
  <><defs><linearGradient id={`sky${a}${b}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
  <rect x={-200} y={-200} width={1480} height={h + 400} fill={`url(#sky${a}${b})`} /></>
);

/* ---------- 1. Intro : rue de Compton la nuit ---------- */
export const StreetIntro: React.FC<StageProps> = ({t, T}) => {
  const w = walk(t, 7.8);
  const kx = 140 + t * 70;
  const carX = -700 + ((t * 520) % 2600);
  return (
    <g>
      <Sky a="#1d2a4a" b="#6b4a7a" />
      {Array.from({length: 40}).map((_, i) => <circle key={i} cx={(i * 263) % 1080} cy={(i * 131) % 700} r={2 + (i % 3)} fill="#fff" opacity={0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i))} />)}
      <circle cx={860} cy={260} r={70} fill="#f6efdd" />
      {/* palmiers qui se balancent */}
      {[120, 520, 930].map((x, i) => (
        <g key={i} transform={`translate(${x},1180)`}>
          <path d={`M-10 0 Q${wave(t, 3, 14, i)} -330 ${8 + wave(t, 3, 20, i)} -640 L22 -640 Q${12 + wave(t, 3, 14, i)} -330 10 0 Z`} fill="#2a2440" />
          <g transform={`translate(${14 + wave(t, 3, 20, i)},-640) rotate(${wave(t, 2.4, 6, i)})`}>
            {[-70, -30, 10, 50, 90, 130].map((a, k) => <path key={k} d="M0 0 Q90 -40 170 30 Q90 -10 0 0 Z" fill="#2a2440" transform={`rotate(${a + 180})`} />)}
          </g>
        </g>
      ))}
      {/* maisons + fenêtres qui s'allument au beat */}
      {[0, 360, 720].map((x, i) => (
        <g key={i}><rect x={x + 10} y={980} width={340} height={260} fill={['#3d3657', '#463c5e', '#3a3350'][i]} />
          <path d={`M${x} 990 L${x + 180} 880 L${x + 360} 990 Z`} fill="#2b2540" />
          <rect x={x + 60} y={1040} width={80} height={70} fill="#f4bc52" opacity={0.35 + 0.65 * pulse(T + i * BEAT, 4)} />
          <rect x={x + 220} y={1040} width={80} height={70} fill="#f4bc52" opacity={0.25 + 0.5 * pulse(T + (i + 2) * BEAT, 4)} /></g>
      ))}
      {/* lampadaire qui grésille */}
      <rect x={760} y={760} width={14} height={500} fill="#24203a" /><rect x={760} y={760} width={120} height={14} fill="#24203a" />
      <ellipse cx={870} cy={790} rx={40} ry={16} fill="#ffe7a0" opacity={Math.sin(t * 37) > -0.8 ? 1 : 0.3} />
      <path d="M840 800 L700 1260 L1050 1260 Z" fill="#ffe7a0" opacity={0.1} />
      <rect x={-200} y={1240} width={1480} height={900} fill="#2e2a3a" />
      <rect x={-200} y={1240} width={1480} height={40} fill="#4a4458" />
      {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={((i * 300 - t * 140) % 1500 + 1500) % 1500 - 200} y={1500} width={160} height={14} fill="#f4bc52" opacity={0.6} />)}
      {/* enseigne diégétique */}
      <g transform="translate(70,860)"><rect width={290} height={70} rx={8} fill="#c9466b" /><text x={145} y={48} textAnchor="middle" fontFamily="Inter, Arial" fontWeight={900} fontSize={34} fill="#fff">COMPTON</text></g>
      {/* lowrider qui passe et rebondit */}
      <g transform={`translate(${carX},${1380 - Math.abs(Math.sin(t * 5)) * 26})`}>
        <rect x={0} y={-60} width={560} height={90} rx={30} fill="#237c80" /><path d="M120 -60 L200 -130 L380 -130 L450 -60 Z" fill="#1d6468" />
        <rect x={215} y={-120} width={70} height={52} fill="#8dd3c3" opacity={0.6} /><rect x={300} y={-120} width={70} height={52} fill="#8dd3c3" opacity={0.6} />
        {[110, 450].map((cx, k) => <g key={k} transform={`translate(${cx},34) rotate(${t * 400})`}><circle r={46} fill="#151515" /><circle r={22} fill="#d9d9d9" /><rect x={-3} y={-22} width={6} height={44} fill="#555" /></g>)}
      </g>
      <Char x={kx} y={1270} s={1.05} look={LOOKS.K} blink={blinkAt(T, 0.3)}
        pose={{thighL: w * 18, shinL: Math.max(0, -w) * 22, thighR: -w * 18, shinR: Math.max(0, w) * 22, armL: -w * 16, armR: w * 16, foreL: -10, foreR: -10, bob: Math.abs(w) * 6, head: nod(T, 5), mouth: 'flat'}} />
    </g>
  );
};

/* ---------- 2. Couplet 1 : souvenirs de famille (salon années 90) ---------- */
export const FamilyParty: React.FC<StageProps> = ({t, T}) => {
  const groove = (ph: number) => wave(T, BEAT * 2, 8, ph);
  return (
    <g>
      <rect x={-200} y={-200} width={1480} height={2400} fill="#f3d9b1" />
      <rect x={-200} y={1150} width={1480} height={1000} fill="#b5643f" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={-200 + i * 220} y={1150} width={8} height={1000} fill="#a35a38" />)}
      {/* papier peint qui pulse */}
      {Array.from({length: 24}).map((_, i) => <circle key={i} cx={(i % 6) * 200 + 40} cy={Math.floor(i / 6) * 220 + 160} r={18 + 6 * pulse(T + (i % 4) * BEAT / 2, 5)} fill="#e8c492" />)}
      {/* ventilateur au plafond */}
      <g transform="translate(540,120)"><rect x={-6} y={-140} width={12} height={140} fill="#5b4634" />
        <g transform={`scale(1,0.3) rotate(${t * 400})`}>{[0, 90, 180, 270].map((a) => <rect key={a} x={0} y={-16} width={230} height={32} rx={14} fill="#7a5a3e" transform={`rotate(${a})`} />)}</g></g>
      {/* télé qui grésille */}
      <g transform="translate(760,720)"><rect width={260} height={200} rx={20} fill="#3a3a3a" /><rect x={20} y={20} width={180} height={150} fill={['#6fa8a8', '#8dd3c3', '#7fbfbf'][Math.floor(t * 9) % 3]} /><circle cx={225} cy={60} r={10} fill="#999" /><circle cx={225} cy={100} r={10} fill="#999" /></g>
      {/* platine qui tourne */}
      <g transform="translate(120,860)"><rect width={300} height={120} rx={12} fill="#8b5e3c" /><g transform={`translate(110,40) scale(1,0.35) rotate(${t * 200})`}><circle r={90} fill="#151515" /><circle r={30} fill="#e0714f" /></g><rect x={200} y={20} width={70} height={14} fill="#ddd" transform="rotate(20 200 20)" /></g>
      {/* table + bouteilles + verres qui se remplissent au beat */}
      <rect x={300} y={1080} width={480} height={30} fill="#7a4a2e" /><rect x={330} y={1110} width={22} height={140} fill="#7a4a2e" /><rect x={730} y={1110} width={22} height={140} fill="#7a4a2e" />
      {[360, 430, 500].map((x, i) => <g key={i}><rect x={x} y={960} width={36} height={120} rx={8} fill={['#6a3a1a', '#2a6a4a', '#8a2a2a'][i]} /><rect x={x + 10} y={930} width={16} height={40} fill={['#6a3a1a', '#2a6a4a', '#8a2a2a'][i]} /></g>)}
      {[600, 670].map((x, i) => <g key={i}><rect x={x} y={1010} width={44} height={70} fill="#fff" opacity={0.6} /><rect x={x} y={1080 - 60 * ((T / BAR + i * 0.5) % 1)} width={44} height={60 * ((T / BAR + i * 0.5) % 1)} fill="#d79a3a" /></g>)}
      {/* bulles de notes de musique */}
      {[0, 1, 2].map((i) => { const k = ((t * 0.6 + i / 3) % 1); return <text key={i} x={180 + i * 60 + wave(t, 2, 20, i)} y={840 - k * 300} fontSize={60} fill="#5b4634" opacity={1 - k}>♪</text>; })}
      {/* adultes qui dansent, verre à la main */}
      <Char x={380} y={1300} s={0.95} look={LOOKS.uncle} blink={blinkAt(T, 1.1)} pose={{lean: groove(0), bob: 8 * pulse(T), armR: -40 + groove(1) * 3, foreR: -70, cupR: '#d79a3a', armL: 20, head: nod(T, 7), thighL: groove(0), thighR: -groove(0), mouth: 'open'}} />
      <Char x={640} y={1310} s={0.92} flip look={LOOKS.aunt} blink={blinkAt(T, 2.2)} pose={{lean: -groove(2), bob: 8 * pulse(T + BEAT / 2), armL: -120 + groove(1) * 4, foreL: -20, armR: -30, foreR: -60, cupR: '#d79a3a', head: -nod(T, 6), thighL: -groove(2), thighR: groove(2), mouth: 'smile'}} />
      <Char x={880} y={1320} s={0.9} flip look={LOOKS.grandpa} blink={blinkAt(T, 0.7)} pose={{lean: groove(3) / 2, armR: -55, foreR: -60, cupR: '#d79a3a', head: nod(T, 4), mouth: 'smile'}} />
      {/* canapé + enfant qui regarde */}
      <rect x={-40} y={1180} width={330} height={150} rx={30} fill="#345867" /><rect x={-40} y={1120} width={330} height={80} rx={30} fill="#3d6575" />
      <Char x={150} y={1320} s={0.62} look={LOOKS.Kkid} blink={blinkAt(T, 0.1)} pose={{sit: true, head: wave(t, 2.6, 6), armL: 30, foreL: -80, armR: -30, foreR: 80, mouth: 'worried', eyes: 'side'}} />
      {/* cadre photo de famille (diégétique) */}
      <g transform={`translate(330,420) rotate(${wave(t, 3, 1.5)})`}><rect width={200} height={240} fill="#7a4a2e" /><rect x={18} y={18} width={164} height={204} fill="#f6efdd" /><circle cx={100} cy={110} r={40} fill="#c9a07a" /><rect x={50} y={150} width={100} height={60} fill="#c9a07a" /></g>
    </g>
  );
};

/* ---------- 3. Refrain : la piscine d'alcool ---------- */
export const PoolParty: React.FC<StageProps> = ({t, T}) => {
  const lvl = Math.min(1, t / (BAR * 2));
  const jumpPh = (k: number) => ((T + k * BEAT) % (BAR)) / BAR;  // un plongeon par mesure, décalé par ami
  return (
    <g>
      <Sky a="#edb095" b="#f8d8ad" />
      <circle cx={180} cy={300} r={110} fill="#f4bc52" opacity={0.9} />
      {/* guirlande lumineuse qui clignote au beat */}
      <path d="M-50 520 Q540 640 1130 520" stroke="#5b2d4f" strokeWidth={5} fill="none" />
      {Array.from({length: 13}).map((_, i) => { const x = -50 + i * 98; const y = 520 + Math.sin((i / 12) * Math.PI) * 118; return <circle key={i} cx={x} cy={y + 14} r={14} fill={['#e0714f', '#f4bc52', '#8dd3c3'][i % 3]} opacity={0.4 + 0.6 * pulse(T + (i % 4) * BEAT, 5)} />; })}
      {/* enceinte qui pompe */}
      <g transform={`translate(860,${760})`}><rect width={160} height={300} rx={16} fill="#20252e" />{[80, 210].map((cy, k) => <circle key={k} cx={80} cy={cy} r={(k ? 58 : 40) * (1 + 0.12 * pulse(T, 9))} fill="#3d4452" />)}</g>
      {/* plage de la piscine */}
      <rect x={-200} y={1080} width={1480} height={1100} fill="#e6d5ac" />
      {/* bassin d'alcool ambré qui monte */}
      <rect x={60} y={1160} width={960} height={600} rx={40} fill="#c98a3a" />
      <rect x={80} y={1180 + 400 * (1 - lvl)} width={920} height={560 - 400 * (1 - lvl)} rx={30} fill="#e7a84a" />
      {Array.from({length: 6}).map((_, i) => <path key={i} d={`M100 ${1250 + i * 80} q110 ${wave(t, 1.6, 16, i)} 220 0 t220 0 t220 0 t220 0`} stroke="#fbd58a" strokeWidth={6} fill="none" opacity={0.7} />)}
      {/* bouée qui flotte */}
      <g transform={`translate(${720 + wave(t, 4, 60)},${1320 + wave(t, 2, 10)}) rotate(${t * 20})`}><circle r={60} fill="#e0714f" /><circle r={28} fill="#e7a84a" />{[0, 90, 180, 270].map((a) => <rect key={a} x={30} y={-10} width={30} height={20} fill="#fff" transform={`rotate(${a})`} />)}</g>
      {/* glaçons */}
      {[0, 1, 2, 3].map((i) => <rect key={i} x={200 + i * 150 + wave(t, 3, 30, i)} y={1300 + wave(t, 2, 12, i)} width={40} height={40} rx={8} fill="#fff" opacity={0.75} transform={`rotate(${t * 30 + i * 20} ${220 + i * 150} 1320)`} />)}
      {/* amis qui plongent tour à tour (arc + éclaboussure sur le temps fort) */}
      {(['friend1', 'friend2', 'friend3'] as const).map((f, k) => {
        const ph = jumpPh(k);
        const air = ph < 0.45; const q = ph / 0.45;
        const x = 200 + k * 260 + (air ? q * 120 : 120);
        const y = air ? 1100 - Math.sin(q * Math.PI) * 300 + q * 220 : 1500;
        return air ? (
          <g key={f}><Char x={x} y={y} s={0.7} look={LOOKS[f]} blink={false} shadow={false} pose={{lean: q * 120, armL: -150, armR: -150, foreL: 0, foreR: 0, thighL: 10, thighR: -10, mouth: 'open'}} /></g>
        ) : (
          <g key={f}>{[0, 1, 2, 3, 4, 5].map((j) => { const e = (ph - 0.45) / 0.55; return <circle key={j} cx={x + Math.cos(j) * 90 * e} cy={1300 - Math.sin(j * 0.5 + 0.4) * 160 * e + 260 * e * e} r={14 * (1 - e)} fill="#fbd58a" />; })}</g>
        );
      })}
      {/* ami qui verse dans la piscine */}
      <Char x={980} y={1110} s={0.8} flip look={LOOKS.friend4} blink={blinkAt(T, 1.7)} pose={{armR: -90 - 20 * pulse(T, 4), foreR: -20, cupR: '#e7a84a', head: nod(T, 7), mouth: 'open', lean: -8}} />
      <path d={`M845 ${940} Q830 1040 ${820 + wave(t, 0.4, 6)} 1180`} stroke="#e7a84a" strokeWidth={10} fill="none" opacity={0.85} />
      {/* le héros au bord, hésitant, la tête qui suit le beat */}
      <Char x={150} y={1110} s={0.95} look={LOOKS.K} blink={blinkAt(T, 0.3)} pose={{head: nod(T, 6), armL: 10, foreL: -20, armR: -20, foreR: -30, mouth: 'flat', eyes: 'side', lean: wave(t, BAR, 3)}} />
    </g>
  );
};

/* ---------- 4. Couplet 2 : la pression du groupe ---------- */
export const Pressure: React.FC<StageProps> = ({t, T}) => {
  const push = (k: number) => 30 * pulse(T + k * BEAT, 4);
  return (
    <g>
      <rect x={-200} y={-200} width={1480} height={2400} fill="#3a2c4a" />
      {/* lumières de soirée qui tournent */}
      {[0, 1, 2].map((i) => <path key={i} d="M0 0 L-160 1400 L160 1400 Z" fill={['#c9466b', '#8dd3c3', '#f4bc52'][i]} opacity={0.18 + 0.1 * pulse(T + i * BEAT)} transform={`translate(${200 + i * 340},-40) rotate(${wave(t, 2.4, 26, i * 2)})`} />)}
      <rect x={-200} y={1300} width={1480} height={900} fill="#2a2036" />
      {/* boule à facettes */}
      <g transform={`translate(540,180) rotate(${t * 40})`}><circle r={80} fill="#d9d9e8" />{Array.from({length: 10}).map((_, i) => <rect key={i} x={-80 + (i % 5) * 32} y={-50 + Math.floor(i / 5) * 50} width={24} height={24} fill="#fff" opacity={0.3 + 0.7 * pulse(T + i * 0.13)} />)}</g>
      {/* verres tendus (bulles qui surgissent sur chaque temps) */}
      {[0, 1, 2, 3].map((i) => { const k = ((T / BEAT + i) % 4) / 4; return <g key={i} transform={`translate(${170 + i * 240},${560 - k * 120}) scale(${0.6 + 0.6 * pulse(T + i * BEAT, 6)})`} opacity={1 - k}><circle r={70} fill="#fff" /><path d="M-22 -30 L22 -30 L16 34 L-16 34 Z" fill="#e7a84a" /><path d="M-30 60 L0 100 L10 60 Z" fill="#fff" /></g>; })}
      {/* les amis autour, qui tendent leurs verres sur le beat */}
      <Char x={150} y={1420} s={0.95} look={LOOKS.friend1} blink={blinkAt(T, 0.6)} pose={{armL: -70 - push(0), foreL: -20, cupL: '#e7a84a', head: nod(T, 8), mouth: 'open', lean: 6}} />
      <Char x={360} y={1460} s={0.9} look={LOOKS.friend2} blink={blinkAt(T, 1.6)} pose={{armL: -80 - push(1), foreL: -10, cupL: '#e7a84a', head: nod(T, 8), mouth: 'open', lean: 8}} />
      <Char x={830} y={1440} s={0.95} flip look={LOOKS.friend3} blink={blinkAt(T, 2.6)} pose={{armL: -75 - push(2), foreL: -15, cupL: '#e7a84a', head: -nod(T, 8), mouth: 'open', lean: 6}} />
      <Char x={1000} y={1470} s={0.88} flip look={LOOKS.friend4} blink={blinkAt(T, 0.9)} pose={{armL: -60 - push(3), foreL: -30, cupL: '#e7a84a', head: nod(T, 8), mouth: 'smile', lean: 4}} />
      {/* le héros au centre : hésite, secoue la tête */}
      <Char x={590} y={1500} s={1.15} look={LOOKS.K} blink={blinkAt(T, 0.3)} pose={{head: wave(t, 0.9, 12), armL: 30, foreL: -100, armR: -30, foreR: 100, mouth: 'worried', lean: wave(t, 1.8, 3)}} />
      {/* petit diable de la tentation sur l'épaule (personnage symbolique) */}
      <g transform={`translate(${470 + wave(t, 1.4, 10)},${880 + wave(t, 0.7, 12)})`}><circle r={44} fill="#e0714f" /><path d="M-30 -30 L-40 -76 L-14 -40 Z M30 -30 L40 -76 L14 -40 Z" fill="#e0714f" /><circle cx={-14} cy={-6} r={6} fill="#1b1b1b" /><circle cx={14} cy={-6} r={6} fill="#1b1b1b" /><path d="M-14 16 Q0 26 14 16" stroke="#1b1b1b" strokeWidth={4} fill="none" /></g>
    </g>
  );
};

/* ---------- 5. La conscience : sous l'eau ---------- */
export const Underwater: React.FC<StageProps> = ({t, T}) => {
  const sink = Math.min(1, t / (BAR * 2));
  const reach = Math.max(0, Math.min(1, (t - BAR * 1.5) / BAR));
  return (
    <g>
      <rect x={-200} y={-200} width={1480} height={2400} fill="#b8762e" />
      <rect x={-200} y={-200} width={1480} height={700} fill="#d99a48" />
      {/* rayons de lumière */}
      {[0, 1, 2, 3].map((i) => <path key={i} d="M0 0 L-90 1900 L90 1900 Z" fill="#fbd58a" opacity={0.12 + 0.06 * Math.sin(t * 1.3 + i)} transform={`translate(${160 + i * 260},-200) rotate(${-12 + i * 8 + wave(t, 5, 4, i)})`} />)}
      {/* bulles */}
      {Array.from({length: 22}).map((_, i) => { const k = ((t * 0.25 + i / 22) % 1); return <circle key={i} cx={(i * 197) % 1080 + wave(t, 2, 18, i)} cy={1900 - k * 2000} r={6 + (i % 5) * 4} fill="none" stroke="#fbe2ad" strokeWidth={3} opacity={0.7} />; })}
      {/* glaçons qui coulent aussi */}
      {[0, 1, 2].map((i) => <rect key={i} x={200 + i * 300} y={300 + t * 60 + i * 140} width={50} height={50} rx={10} fill="#fff" opacity={0.35} transform={`rotate(${t * 25 + i * 30} ${225 + i * 300} ${325 + t * 60 + i * 140})`} />)}
      {/* le héros qui coule lentement (yeux fermés), tourne sur lui-même */}
      <g transform={`translate(${540},${700 + sink * 520}) rotate(${-20 + t * 6})`}>
        <Char x={0} y={0} s={1} look={LOOKS.K} blink shadow={false} pose={{armL: -140 + wave(t, 3, 10), armR: -150 + wave(t, 3, 10, 1), foreL: 20, foreR: 20, thighL: 20 + wave(t, 2.2, 8), thighR: -10, shinL: 30, shinR: 20, eyes: 'closed', mouth: 'flat'}} />
      </g>
      {/* la conscience : un double lumineux, plus calme, qui tend la main */}
      <g opacity={Math.min(1, t / 1.2)}>
        <Char x={860} y={1700 - reach * 120} s={0.95} flip look={LOOKS.Kglow} blink={blinkAt(T, 1.9)} shadow={false} pose={{armL: -60 - 50 * reach, foreL: -20, head: wave(t, 3, 4), mouth: 'smile', lean: -6}} />
      </g>
      {/* algues qui ondulent */}
      {[60, 300, 980].map((x, i) => <path key={i} d={`M${x} 1920 Q${x + wave(t, 2.5, 40, i)} 1700 ${x + wave(t, 2.5, 20, i + 1)} 1520`} stroke="#7a4a1e" strokeWidth={22} fill="none" strokeLinecap="round" />)}
    </g>
  );
};

/* ---------- 6. Outro : à l'aube, il s'en va ---------- */
export const DawnOutro: React.FC<StageProps> = ({t, T}) => {
  const sunrise = Math.min(1, t / (BAR * 2));
  const stand = Math.max(0, Math.min(1, (t - BAR * 1.2) / 0.8));
  const w = walk(t, 7.5) * (t > BAR * 1.8 ? 1 : 0);
  const kx = 340 + Math.max(0, t - BAR * 1.8) * 120;
  return (
    <g>
      <Sky a={sunrise > 0.5 ? '#bfdde3' : '#5b4a7a'} b="#f6efdd" />
      <circle cx={540} cy={1060 - sunrise * 520} r={130} fill="#f4bc52" />
      {[0, 1, 2].map((i) => <ellipse key={i} cx={((i * 420 + t * 30) % 1500) - 200} cy={260 + i * 120} rx={160} ry={40} fill="#fff" opacity={0.7} />)}
      {[0, 1].map((i) => <path key={i} d={`M${200 + i * 500 + t * 60} ${400 + i * 60} q20 -20 40 0 q20 -20 40 0`} stroke="#345867" strokeWidth={5} fill="none" />)}
      <rect x={-200} y={1080} width={1480} height={1100} fill="#e6d5ac" />
      <rect x={80} y={1180} width={920} height={500} rx={30} fill="#8dd3c3" opacity={0.9} />
      {Array.from({length: 4}).map((_, i) => <path key={i} d={`M100 ${1250 + i * 90} q110 ${wave(t, 3, 8, i)} 220 0 t220 0 t220 0 t220 0`} stroke="#fff" strokeWidth={5} fill="none" opacity={0.6} />)}
      {/* verres vides abandonnés */}
      {[700, 760, 900].map((x, i) => <g key={i} transform={`translate(${x},1150) rotate(${i === 1 ? 80 : 0})`}><path d="M-16 -40 L16 -40 L12 6 L-12 6 Z" fill="#fff" opacity={0.8} /></g>)}
      {/* plaque de rue diégétique */}
      <g transform="translate(800,820)"><rect x={-6} y={0} width={12} height={260} fill="#345867" /><rect x={-150} y={-60} width={300} height={70} rx={8} fill="#237c80" /><text x={0} y={-12} textAnchor="middle" fontFamily="Inter, Arial" fontWeight={900} fontSize={30} fill="#fff">GOOD KID AVE</text></g>
      <Char x={kx} y={1170} s={1} look={LOOKS.K} blink={blinkAt(T, 0.3)}
        pose={stand < 1 ? {sit: true, head: -10 + stand * 10, armL: 20, foreL: -40, armR: -20, foreR: 40, mouth: 'flat'} : {thighL: w * 18, shinL: Math.max(0, -w) * 22, thighR: -w * 18, shinR: Math.max(0, w) * 22, armL: -w * 16, armR: w * 16, bob: Math.abs(w) * 6, head: nod(T, 3), mouth: 'smile'}} />
    </g>
  );
};

export const STAGES = {StreetIntro, FamilyParty, PoolParty, Pressure, Underwater, DawnOutro};
