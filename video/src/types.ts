export type Word = {w: string; start: number; end: number};
export type Segment = {
  id: string; scene: string; text: string; keywords?: string[];
  start: number; end: number; words: Word[];
  /** Textes animés optionnels : {text, at: mot déclencheur} */
  chips?: {text: string; at: string}[]; kinetic?: {text: string; at?: string}[];
};
export type Palette = {bg: string; main: string; accent: string; ink: string};
export type EpisodeProps = {
  slug: string; title: string; artist: string; palette: Palette;
  voiceOffset: number; duration: number; segments: Segment[]; audio: string;
  /** Temps des beats (s, absolus), énergie par beat, moments musique seule [début, fin]. */
  beats?: number[]; energy?: number[]; breaks?: [number, number][]; cuts?: number[];
};
export type SceneProps = {seg: Segment; p: Palette; ep: EpisodeProps};
