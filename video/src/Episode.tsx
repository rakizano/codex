import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig, CalculateMetadataFunction} from 'remotion';
import {EpisodeProps} from './types';
import {SCENES} from './scenes/scenes';
import {FONT} from './components/primitives';

const TAIL = 2.4; // secondes après la dernière phrase

/** Sous-titres par groupes de 3 mots, mot courant surligné, dans le tiers bas (zone sûre TikTok). */
const Subtitles: React.FC<{ep: EpisodeProps}> = ({ep}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps - ep.voiceOffset;
  const words = ep.segments.flatMap((s) => s.words);
  const i = words.findIndex((w) => t >= w.start && t < w.end + 0.15);
  if (i < 0) return null;
  const g0 = Math.floor(i / 3) * 3;
  const group = words.slice(g0, g0 + 3);
  return (
    <div style={{position: 'absolute', bottom: 330, width: '100%', display: 'flex', justifyContent: 'center'}}>
      <div style={{background: '#000000b0', borderRadius: 22, padding: '14px 28px', maxWidth: 940, textAlign: 'center',
        fontFamily: FONT, fontWeight: 800, fontSize: 62, lineHeight: 1.15, color: '#fff'}}>
        {group.map((w, k) => (
          <span key={k} style={{color: g0 + k === i ? ep.palette.accent : '#fff', marginRight: 14}}>{w.w}</span>
        ))}
      </div>
    </div>
  );
};

const Progress: React.FC<{ep: EpisodeProps}> = ({ep}) => {
  const f = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  return (
    <>
      <div style={{position: 'absolute', top: 70, left: 60, fontFamily: FONT, fontWeight: 900, fontSize: 34, letterSpacing: 6, color: ep.palette.ink, opacity: 0.85}}>
        L'ENVERS DU SON
      </div>
      <div style={{position: 'absolute', top: 120, left: 60, width: 960, height: 8, borderRadius: 4, background: '#ffffff22'}}>
        <div style={{width: `${(f / durationInFrames) * 100}%`, height: 8, borderRadius: 4, background: ep.palette.main}} />
      </div>
    </>
  );
};

export const Episode: React.FC<EpisodeProps> = (ep) => {
  const {fps, durationInFrames} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: ep.palette.bg}}>
      {ep.segments.map((seg, i) => {
        const from = i === 0 ? 0 : Math.round((seg.start + ep.voiceOffset - 0.25) * fps);
        const next = ep.segments[i + 1];
        const to = next ? Math.round((next.start + ep.voiceOffset - 0.25) * fps) : durationInFrames;
        const Scene = SCENES[seg.scene];
        // start = début de la Sequence (en temps voix) pour que wordTime() soit relatif à la scène
        const local = {...seg, start: from / fps - ep.voiceOffset};
        return (
          <Sequence key={seg.id} from={from} durationInFrames={to - from} name={seg.scene}>
            {Scene ? <Scene seg={local} p={ep.palette} ep={ep} /> : null}
          </Sequence>
        );
      })}
      <Progress ep={ep} />
      <Subtitles ep={ep} />
      <Audio src={staticFile(ep.audio)} />
    </AbsoluteFill>
  );
};

export const calcEpisode: CalculateMetadataFunction<EpisodeProps> = async ({props}) => {
  const tl = await fetch(staticFile(`${props.slug}/timeline.json`)).then((r) => r.json());
  const script = await fetch(staticFile(`${props.slug}/script.json`)).then((r) => r.json());
  const merged: EpisodeProps = {...props, title: script.title, artist: script.artist, palette: script.palette, segments: tl.segments, duration: tl.duration};
  return {props: merged, durationInFrames: Math.ceil((props.voiceOffset + tl.duration + TAIL) * 30)};
};
