import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, CalculateMetadataFunction, spring} from 'remotion';
import {EpisodeProps} from './types';
import {SCENES} from './scenes/scenes';
import {FONT} from './components/primitives';
import {BackgroundWords, BeatBars, BeatContext, BeatZoom, CutRings, Grain, LightLeak, LiveBackground, Particles, SceneShell, TransitionKind, useBeat, VinylThroughLens} from './components/fx';

/** Menu Bang Motion §4c : types variés, ≥ 1 avec profondeur, objet-wipe (vinyle) ≤ 2, jamais deux fois de suite. */
const TRANSITIONS: TransitionKind[] = ['vinyl', 'rotY', 'rack', 'push', 'whip', 'leak', 'rotY', 'vinyl', 'rack', 'push'];

const TAIL = 2.4; // secondes après la dernière phrase
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\d]/gu, '');

/** Sous-titres : groupes de 3 mots, chaque mot « saute » à son apparition, mot courant + mots-clés en couleur. */
const Subtitles: React.FC<{ep: EpisodeProps}> = ({ep}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps - ep.voiceOffset;
  const words = ep.segments.flatMap((s) => s.words.map((w) => ({...w, key: (s.keywords ?? []).some((k) => norm(w.w).startsWith(norm(k).slice(0, 5)))})));
  const i = words.findIndex((w) => t >= w.start && t < w.end + 0.15);
  if (i < 0) return null;
  const g0 = Math.floor(i / 3) * 3;
  const group = words.slice(g0, g0 + 3);
  return (
    <div style={{position: 'absolute', bottom: 340, width: '100%', display: 'flex', justifyContent: 'center'}}>
      <div style={{background: '#000000b8', borderRadius: 24, padding: '14px 30px', maxWidth: 940, textAlign: 'center',
        fontFamily: FONT, fontWeight: 900, fontSize: 64, lineHeight: 1.15, color: '#fff', boxShadow: '0 12px 40px #0007'}}>
        {group.map((w, k) => {
          const shown = t >= w.start - 0.02;
          const s = spring({frame: Math.round((t - w.start) * fps), fps, config: {damping: 9, mass: 0.4}});
          const cur = g0 + k === i;
          return (
            <span key={k} style={{display: 'inline-block', margin: '0 10px', opacity: shown ? 1 : 0.25,
              transform: `scale(${shown ? 0.85 + 0.15 * s + (cur ? 0.06 : 0) : 0.85})`,
              color: w.key ? ep.palette.main : cur ? ep.palette.accent : '#fff'}}>{w.w}</span>
          );
        })}
      </div>
    </div>
  );
};

const Header: React.FC<{ep: EpisodeProps}> = ({ep}) => {
  const f = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const {pulse} = useBeat(0);
  return (
    <>
      <div style={{position: 'absolute', top: 66, left: 60, fontFamily: FONT, fontWeight: 900, fontSize: 34, letterSpacing: 6, color: ep.palette.ink, opacity: 0.9}}>
        <span style={{display: 'inline-block', transform: `rotate(${f * 4}deg)`, marginRight: 12}}>◉</span>L'ENVERS DU SON
      </div>
      <div style={{position: 'absolute', top: 120, left: 60, width: 960, height: 8, borderRadius: 4, background: '#ffffff22'}}>
        <div style={{width: `${(f / durationInFrames) * 100}%`, height: 8, borderRadius: 4, background: ep.palette.main, boxShadow: `0 0 ${8 + pulse * 16}px ${ep.palette.main}`}} />
      </div>
    </>
  );
};

/** Carte « moment musical » pendant les music_breaks (là où le son officiel ajouté dans TikTok s'entend seul). */
const MusicMoment: React.FC<{ep: EpisodeProps}> = ({ep}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {pulse} = useBeat(0);
  const t = f / fps;
  const br = (ep.breaks ?? []).find(([a, z]) => t >= a - 0.1 && t <= z + 0.1);
  if (!br) return null;
  const k = Math.min(1, (t - br[0] + 0.1) / 0.25, (br[1] + 0.1 - t) / 0.25);
  return (
    <div style={{position: 'absolute', left: '50%', bottom: 350, opacity: k, transform: `translateX(-50%) scale(${0.8 + 0.2 * k + pulse * 0.06}) rotate(${Math.sin(t * 4) * 3}deg)`,
      background: ep.palette.bg, color: ep.palette.accent, border: `6px solid ${ep.palette.accent}`, whiteSpace: 'nowrap', fontFamily: FONT, fontWeight: 900, fontSize: 56, padding: '16px 40px', borderRadius: 999,
      boxShadow: `0 0 ${20 + pulse * 40}px ${ep.palette.accent}`}}>♪ écoute le son ♪</div>
  );
};

export const Episode: React.FC<EpisodeProps> = (ep) => {
  const {fps, durationInFrames} = useVideoConfig();
  // RACCORD : coupes calées sur le beat (beats.json/cuts) ; à défaut, 0,25 s avant la phrase
  const bounds = ep.segments.slice(1).map((s, i) => Math.round(((ep.cuts?.[i]) ?? (s.start + ep.voiceOffset - 0.25)) * fps));
  return (
    <BeatContext.Provider value={{beats: ep.beats ?? [], energy: ep.energy ?? [], offset: 0}}>
      <AbsoluteFill style={{background: ep.palette.bg, overflow: 'hidden'}}>
        <LiveBackground p={ep.palette} />
        <Particles color={ep.palette.ink} />
        <BackgroundWords ep={ep} />
        {ep.segments.map((seg, i) => {
          const from = i === 0 ? 0 : bounds[i - 1];
          const to = i < bounds.length ? bounds[i] : durationInFrames;
          const Scene = SCENES[seg.scene];
          // start = début de la Sequence (en temps voix) pour que wordTime() soit relatif à la scène
          const local = {...seg, start: from / fps - ep.voiceOffset};
          const exitFrames = i < bounds.length ? Math.round(0.45 * fps) : 0;   // la sortie chevauche l'entrée suivante
          return (
            <Sequence key={seg.id} from={from} durationInFrames={to - from + exitFrames} name={`${seg.scene} (${TRANSITIONS[i - 1] ?? '—'} → ${TRANSITIONS[i] ?? '—'})`}
              style={{zIndex: ['push', 'rack', 'whip'].includes(TRANSITIONS[i] ?? '') ? 2 : 1}}>
              <SceneShell enter={i ? TRANSITIONS[i - 1] : undefined} exit={i < bounds.length ? TRANSITIONS[i] : undefined}
                exitAt={(to - from) / fps} dir={i % 2 ? -1 : 1}>
                <BeatZoom>{Scene ? <Scene seg={local} p={ep.palette} ep={ep} /> : null}</BeatZoom>
              </SceneShell>
            </Sequence>
          );
        })}
        {bounds.map((b, i) => (
          <Sequence key={`r${i}`} from={b} durationInFrames={Math.round(0.9 * fps)} name="rings" style={{zIndex: 3}}>
            <CutRings p={ep.palette} />
          </Sequence>
        ))}
        {bounds.map((b, i) => TRANSITIONS[i] === 'vinyl' ? (
          <Sequence key={`v${i}`} from={b - Math.round(0.5 * fps)} durationInFrames={Math.round(1.0 * fps)} name="vinyl-through-lens" style={{zIndex: 4}}>
            <VinylThroughLens p={ep.palette} dir={i % 2 ? -1 : 1} />
          </Sequence>
        ) : TRANSITIONS[i] === 'leak' ? (
          <Sequence key={`l${i}`} from={b - Math.round(0.45 * fps)} durationInFrames={Math.round(0.9 * fps)} name="light-leak" style={{zIndex: 4}}>
            <LightLeak p={ep.palette} dir={i % 2 ? -1 : 1} />
          </Sequence>
        ) : null)}
        <BeatBars p={ep.palette} y={1920} height={70} opacity={0.35} />
        <Grain />
        <Header ep={ep} />
        <MusicMoment ep={ep} />
        <Subtitles ep={ep} />
        <Audio src={staticFile(ep.audio)} />
      </AbsoluteFill>
    </BeatContext.Provider>
  );
};

export const calcEpisode: CalculateMetadataFunction<EpisodeProps> = async ({props}) => {
  const tl = await fetch(staticFile(`${props.slug}/timeline.json`)).then((r) => r.json());
  const script = await fetch(staticFile(`${props.slug}/script.json`)).then((r) => r.json());
  let beats: {beats?: number[]; energy?: number[]; breaks?: [number, number][]; cuts?: number[]} = {};
  try { beats = await fetch(staticFile(`${props.slug}/beats.json`)).then((r) => r.json()); } catch { /* pas de beat : animations sans pulsation */ }
  const merged: EpisodeProps = {...props, title: script.title, artist: script.artist, palette: script.palette, segments: tl.segments, duration: tl.duration,
    beats: beats.beats ?? [], energy: beats.energy ?? [], breaks: beats.breaks ?? [], cuts: beats.cuts ?? []};
  return {props: merged, durationInFrames: Math.ceil((props.voiceOffset + tl.duration + TAIL) * 30)};
};
