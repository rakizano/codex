import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Episode, calcEpisode} from './Episode';
import {EpisodeProps} from './types';

const defaults: EpisodeProps = {
  slug: 'swimming-pools', title: '', artist: '', voiceOffset: 0.6, duration: 0, segments: [],
  palette: {bg: '#0b1b3a', main: '#19c3d6', accent: '#ffc94a', ink: '#eaf6ff'}, audio: 'swimming-pools/mix.wav',
};

const Root: React.FC = () =>
  React.createElement(Composition, {
    id: 'Episode', component: Episode as React.FC<any>, width: 1080, height: 1920, fps: 30, durationInFrames: 300,
    defaultProps: defaults, calculateMetadata: calcEpisode as any,
  });

registerRoot(Root);
