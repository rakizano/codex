import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Episode, calcEpisode} from './Episode';
import {EpisodeProps} from './types';
import {Clip, ClipProps} from './clip/Clip';
import {BAR} from './clip/rig';

const defaults: EpisodeProps = {
  slug: 'swimming-pools', title: '', artist: '', voiceOffset: 0.6, duration: 0, segments: [],
  palette: {bg: '#0b1b3a', main: '#19c3d6', accent: '#ffc94a', ink: '#eaf6ff'}, audio: 'swimming-pools/mix.wav',
};

/** Clip musical « Swimming Pools » : 20 mesures à 74 BPM (≈ 65 s). Caméra : [zoom, focusX, focusY] (zoom ≥ 1,08). */
const clipDefaults: ClipProps = {
  title: 'Swimming Pools', offset: 0.5, audio: null,
  plan: [
    {stage: 'StreetIntro', bars: 2, slide: 'cut', cam: [[1.9, 300, 1120], [1.25, 520, 1050], [1.3, 600, 1080]]},
    {stage: 'FamilyParty', bars: 4, slide: 'h', cam: [[1.55, 160, 1180], [1.15, 540, 1000], [1.6, 520, 1050], [1.12, 540, 960]]},
    {stage: 'PoolParty', bars: 4, slide: 'v', cam: [[1.7, 200, 1000], [1.12, 540, 1060], [1.45, 600, 1250], [1.1, 540, 1080]]},
    {stage: 'Pressure', bars: 4, slide: 'h', cam: [[1.95, 590, 1100], [1.2, 560, 1080], [1.5, 560, 1000], [1.15, 540, 1060]]},
    {stage: 'Underwater', bars: 3, slide: 'v', cam: [[1.12, 540, 900], [1.35, 620, 1100], [1.5, 760, 1350]]},
    {stage: 'DawnOutro', bars: 3, slide: 'h', cam: [[1.6, 400, 1000], [1.15, 540, 960], [1.1, 600, 960]]},
  ],
};
const clipFrames = (p: ClipProps) => Math.round((p.offset + p.plan.reduce((a, s) => a + s.bars, 0) * BAR + 1) * 30);

const Root: React.FC = () =>
  React.createElement(React.Fragment, null,
    React.createElement(Composition, {
      id: 'Episode', component: Episode as React.FC<any>, width: 1080, height: 1920, fps: 30, durationInFrames: 300,
      defaultProps: defaults, calculateMetadata: calcEpisode as any,
    }),
    React.createElement(Composition, {
      id: 'Clip', component: Clip as React.FC<any>, width: 1080, height: 1920, fps: 30, durationInFrames: clipFrames(clipDefaults),
      defaultProps: clipDefaults, calculateMetadata: (async ({props}: {props: ClipProps}) => ({durationInFrames: clipFrames(props)})) as any,
    }),
  );

registerRoot(Root);
