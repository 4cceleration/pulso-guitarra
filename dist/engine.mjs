const NAMES = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const STANDARD_TUNING = [64, 59, 55, 50, 45, 40];

export function pitch(midi) {
  return { name: NAMES[midi % 12], octave: Math.floor(midi / 12) - 1 };
}

export function pitchText(midi) {
  const { name, octave } = pitch(midi);
  return name + octave;
}

export function fingering(midi) {
  // Keep melodies around the first few frets when possible.
  const options = STANDARD_TUNING.map((open, index) => ({ string: index + 1, fret: midi - open }));
  return options.find(({ fret }) => fret >= 0 && fret <= 5)
    ?? options.find(({ fret }) => fret >= 0 && fret <= 24);
}

function exercise(id, title, artist, bpm, tone, melody) {
  let position = 0;
  const notes = melody.map(([midi, beats, string, fret]) => {
    const time = position * 60000 / bpm;
    position += beats;
    return { midi, time, duration: beats * 60000 / bpm, ...(string ? { string, fret } : fingering(midi)) };
  });
  return { id, title, artist, bpm, tone, notes };
}

export const songs = [
  exercise('feliz', 'Feliz cumpleaños', 'Tradicional', 84, 'mint', [
    [55,.5],[55,.5],[57,1],[55,1],[60,1],[59,2],
    [55,.5],[55,.5],[57,1],[55,1],[62,1],[60,2],
    [55,.5],[55,.5],[67,1],[64,1],[60,1],[59,1],[57,2],
    [65,.5],[65,.5],[64,1],[60,1],[62,1],[60,2]
  ]),
  exercise('voltaje', 'Alto voltaje', 'Riff original · Rock', 100, 'amber', [
    [40,.5,6,0],[40,.5,6,0],[43,1,6,3],[45,1,6,5],[43,1,6,3],
    [40,.5,6,0],[40,.5,6,0],[43,1,6,3],[46,1,6,6],[45,1,6,5],
    [40,.5,6,0],[40,.5,6,0],[43,1,6,3],[45,1,6,5],[43,1,6,3],
    [48,1,5,3],[46,1,5,1],[45,1,5,0],[40,1,6,0]
  ]),
  exercise('medianoche', 'Medianoche', 'Riff original · Metal', 112, 'violet', [
    [40,.5,6,0],[40,.5,6,0],[47,1,5,2],[40,.5,6,0],[40,.5,6,0],[48,1,5,3],
    [40,.5,6,0],[40,.5,6,0],[47,1,5,2],[45,1,5,0],[43,1,6,3],
    [40,.5,6,0],[40,.5,6,0],[47,1,5,2],[40,.5,6,0],[40,.5,6,0],[48,1,5,3],
    [50,1,5,5],[48,1,5,3],[47,1,5,2],[40,1,6,0]
  ])
];

export class Attempt {
  constructor(notes, speed, timed, startsAt) {
    this.notes = notes;
    this.speed = speed;
    this.timed = timed;
    this.startsAt = startsAt;
    this.index = 0;
    this.status = 'playing';
    this.failure = null;
  }

  get note() { return this.notes[this.index]; }

  get due() { return this.startsAt + this.note.time / this.speed; }

  get tolerance() {
    const previous = this.notes[this.index - 1];
    const next = this.notes[this.index + 1];
    const before = previous ? this.note.time - previous.time : Infinity;
    const after = next ? next.time - this.note.time : Infinity;
    return Math.min(245, Math.max(55, Math.min(before, after) / this.speed * .46));
  }

  fail(reason, heard = null) {
    this.status = 'failed';
    this.failure = { reason, heard, expected: this.note.midi };
  }

  tick(now) {
    // Frames can need a short confirmation to identify the attack.
    if (this.status === 'playing' && this.timed && now > this.due + this.tolerance + 105) {
      this.fail('missing');
    }
    return this.status;
  }

  hear(midi, at) {
    if (this.status !== 'playing') return this.status;
    if (this.timed && at > this.due + this.tolerance) this.fail('late', midi);
    else if (this.timed && at < this.due - this.tolerance) this.fail('early', midi);
    else if (midi !== this.note.midi) this.fail('pitch', midi);
    else if (++this.index === this.notes.length) this.status = 'complete';
    return this.status;
  }
}

export class PitchDetector {
  difference = new Float32Array(240);

  analyse(buffer, sampleRate) {
    const stride = 4;
    const reducedRate = sampleRate / stride;
    const minLag = Math.max(2, Math.floor(reducedRate / 1550));
    const maxLag = Math.min(this.difference.length - 2, Math.ceil(reducedRate / 52));
    const samples = Math.min(buffer.length, Math.floor(sampleRate * .048));
    const offset = buffer.length - samples;
    const limit = Math.floor(samples / stride) - maxLag;
    if (limit < 32) return null;
    let cumulative = 0;
    const differences = this.difference;
    differences[0] = 1;
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < limit; i++) {
        const delta = buffer[offset + i * stride] - buffer[offset + (i + lag) * stride];
        sum += delta * delta;
      }
      cumulative += sum;
      differences[lag] = cumulative ? sum * lag / cumulative : 1;
    }
    for (let lag = minLag; lag < maxLag; lag++) {
      if (differences[lag] > .20 || differences[lag] >= differences[lag + 1]) continue;
      const left = differences[lag - 1];
      const middle = differences[lag];
      const right = differences[lag + 1];
      const denominator = 2 * (2 * middle - right - left);
      const correction = denominator ? (right - left) / denominator : 0;
      const hz = reducedRate / (lag + correction);
      const rawMidi = 69 + 12 * Math.log2(hz / 440);
      if (Math.abs(rawMidi - Math.round(rawMidi)) <= .47) return Math.round(rawMidi);
      return null;
    }
    return null;
  }
}

export class Attacks {
  constructor() { this.reset(); }

  reset() {
    this.pending = null;
    this.lastMidi = null;
    this.lastAt = -Infinity;
    this.envelope = 0;
    this.onset = null;
  }

  read(midi, volume, threshold, now) {
    const attack = volume > this.envelope * 1.45 && volume - this.envelope > threshold * .58;
    this.envelope = Math.max(volume, this.envelope * .83);
    if (attack && now - this.lastAt > 100) this.onset = now;
    if (volume < threshold * .72) {
      this.lastMidi = null;
      this.pending = null;
      return null;
    }
    if (this.onset !== null && now - this.onset > 185) this.onset = null;
    if (midi === null) {
      this.pending = null;
      return null;
    }
    if (midi === this.lastMidi && this.onset === null) {
      this.pending = null;
      return null;
    }
    if (now - this.lastAt < 80) return null;
    if (this.pending?.midi !== midi) {
      this.pending = { midi, at: this.onset ?? now };
      return null;
    }
    const event = { midi, at: this.pending.at - 22 };
    this.pending = null;
    this.onset = null;
    this.lastMidi = midi;
    this.lastAt = now;
    return event;
  }
}
