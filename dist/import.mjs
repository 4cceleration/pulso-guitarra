import { importer, midi } from './vendor/alphatab.mjs';
import { fingering } from './engine.mjs';

const LOWEST_NOTE = 32;
const HIGHEST_NOTE = 90;

export function readTab(bytes, filename) {
  const score = importer.ScoreLoader.loadScoreFromBytes(bytes);
  const generator = new midi.MidiFileGenerator(score, null, new midi.AlphaSynthMidiFileHandler(new midi.MidiFile()));
  generator.generate();
  const playbackBars = generator.tickLookup.masterBars;
  const tracks = score.tracks.filter((track) => !track.isPercussion).map((track) => {
    const onsets = new Map();
    let barTime = 0;
    for (const bar of playbackBars) {
      const changes = bar.tempoChanges;
      const bpm = changes[0]?.tempo || score.tempo || 84;
      function elapsed(tick) {
        let time = 0;
        let previousTick = bar.start;
        let tempo = bpm;
        for (const change of changes) {
          if (change.tick > tick) break;
          time += (change.tick - previousTick) * 60000 / (960 * tempo);
          previousTick = change.tick;
          tempo = change.tempo;
        }
        return time + (tick - previousTick) * 60000 / (960 * tempo);
      }
      for (const staff of track.staves) {
        if (staff.isPercussion) continue;
        for (const voice of staff.bars[bar.masterBar.index]?.voices ?? []) {
          for (const beat of voice.beats) {
            if (beat.isRest || beat.graceType || beat.playbackStart < 0) continue;
            const tick = bar.start + beat.playbackStart;
            for (const note of beat.notes) {
              if (note.isTieDestination || note.isDead || note.realValue < LOWEST_NOTE || note.realValue > HIGHEST_NOTE) continue;
              const number = note.realValue;
              const position = note.isStringed && staff.tuning.length
                ? { string: staff.tuning.length + 1 - note.string, fret: note.fret }
                : fingering(number);
              const existing = onsets.get(tick);
              if (existing && existing.midi <= number) continue;
              onsets.set(tick, {
                midi: number, time: barTime + elapsed(tick),
                duration: Math.max(25, elapsed(tick + beat.playbackDuration) - elapsed(tick)),
                bpm: changes.findLast((change) => change.tick <= tick)?.tempo || bpm,
                ...position
              });
            }
          }
        }
      }
      barTime += elapsed(bar.end);
    }
    const notes = [...onsets.values()].sort((a, b) => a.time - b.time);
    const firstTime = notes[0]?.time ?? 0;
    const name = track.name || 'Pista ' + (track.index + 1);
    const songName = score.masterBars.some((bar) => bar.section?.text === name) ? name.split(' - ') : [];
    return {
      name,
      artist: songName.length > 1 ? songName[0] : '',
      title: songName.length > 1 ? songName.slice(1).join(' - ') : '',
      bpm: notes[0]?.bpm || score.tempo || 84,
      notes: notes.map(({ bpm, ...note }) => ({ ...note, time: note.time - firstTime })),
      tuning: track.staves.find((staff) => staff.tuning.length)?.tuning ?? []
    };
  }).filter((track) => track.notes.length > 0 && track.notes.length <= 20000);
  return {
    title: score.title?.trim() || filename.replace(/\.[^.]+$/, ''),
    artist: score.artist?.trim() || '',
    tracks
  };
}
