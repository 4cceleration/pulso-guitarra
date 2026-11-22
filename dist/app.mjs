import { Attempt, Attacks, PitchDetector, pitch, pitchText, songs } from './engine.mjs';
import { renderFretboard } from './fretboard.mjs';

const $ = (id) => document.getElementById(id);
const getStored = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('pulso-songs') ?? '[]');
    return Array.isArray(stored) ? stored.filter((song) => song.id && song.title && song.notes?.length) : [];
  } catch {
    return [];
  }
};
const imported = getStored();
let song = songs[0];
let phase = 'idle';
let attempt = null;
let lastIndex = -1;
let startAt = 0;
let beatLength = 0;
let countdown = 0;
let calmUntil = 0;
let frameId = 0;
let lastAudioFrame = 0;
let input = null;
let opening = false;
let audioContext = null;
let demo = null;
let currentImport = null;
let importing = false;
let noise = .0015;
const detector = new PitchDetector();
const attacks = new Attacks();
const musicIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l11-3v12M9 18c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2Zm11-3c0 1.1-1.3 2-3 2s-3-.9-3-2 1.3-2 3-2 3 .9 3 2Z"/></svg>';
const playPath = 'M8 5l11 7-11 7z';
const stopPath = 'M6 6h12v12H6z';
const restartPath = 'M3 10a9 9 0 1 1 1.3 7M3 4v6h6';
const idleHint = 'Pon tu ampli en limpio y cerca del Mac.';
const target = document.querySelector('.target');
const progress = document.querySelector('.progress-bar');
const fretboard = $('fretboard');

function active() {
  return phase === 'counting' || phase === 'playing';
}

function feedback(title, detail) {
  $('feedback-title').textContent = title;
  $('feedback-detail').textContent = detail;
}

function updateActions() {
  const locked = active() || opening;
  $('speed').disabled = locked || Boolean(demo);
  $('mode').disabled = locked || Boolean(demo);
  $('import').disabled = locked || importing;
  $('mic-button').disabled = locked;
  $('listen').disabled = locked;
  $('start').disabled = opening;
  for (const button of $('songs').querySelectorAll('button')) button.disabled = locked;
  const micLabel = opening ? 'Activando…' : input ? 'Micrófono activo' : 'Activar micrófono';
  $('mic-label').textContent = micLabel;
  $('mic-button').setAttribute('aria-pressed', String(Boolean(input)));
  const button = active() ? ['Detener', stopPath] : phase === 'failed' || phase === 'complete'
    ? ['Reiniciar', restartPath] : ['Empezar', playPath];
  $('start-label').textContent = button[0];
  $('start-icon').setAttribute('d', button[1]);
  $('listen').querySelector('span').textContent = demo ? 'Detener audio' : 'Escuchar';
}

function updateProgress(index) {
  const total = song.notes.length;
  $('note-count').textContent = index + ' / ' + total + ' notas';
  $('progress-fill').style.width = (index / total * 100) + '%';
  progress.setAttribute('aria-valuemax', total);
  progress.setAttribute('aria-valuenow', index);
  $('tempo-text').textContent = $('mode').value === 'free'
    ? 'A tu ritmo'
    : Math.round(song.bpm * Number($('speed').value)) + ' BPM';
}

function showNote(index, label) {
  const note = song.notes[index];
  const { name, octave } = pitch(note.midi);
  const small = document.createElement('small');
  small.textContent = octave;
  $('target-label').textContent = label;
  $('target-note').replaceChildren(document.createTextNode(name), small);
  const hasPosition = note.string > 0 && note.fret >= 0;
  const fingering = $('fingering');
  fingering.replaceChildren();
  if (hasPosition) {
    for (const [name, value] of [['Cuerda', note.string], ['Traste', note.fret]]) {
      const position = document.createElement('span');
      const key = document.createElement('small');
      const number = document.createElement('strong');
      key.textContent = name;
      number.textContent = value;
      position.append(key, number);
      fingering.append(position);
    }
  }
  const previous = song.notes[index - 1];
  const repeat = label === 'TOCA ESTA NOTA' && note.string === previous?.string && note.fret === previous?.fret;
  $('position-hint').textContent = !hasPosition ? 'Busca esta nota en tu guitarra.'
    : repeat ? 'Toca la misma nota otra vez.'
    : note.fret === 0 ? 'Al aire. Toca sin pisar.' : 'Pisa justo antes del metal.';
  renderFretboard(fretboard, note, Math.max(2, song.tuning?.length || 6, note.string || 0));
}

function reset(hint = idleHint) {
  phase = 'idle';
  $('practice').dataset.phase = phase;
  target.dataset.cue = 'false';
  attempt = null;
  showNote(0, 'PRIMERA NOTA');
  updateProgress(0);
  feedback('', hint);
  updateActions();
}

function selectSong(next) {
  if (phase === 'failed' && song.id === next.id) return;
  stopDemo();
  song = next;
  $('song-title').textContent = song.title;
  const tuning = song.tuning?.length ? 'Afinación ' + [...song.tuning].reverse().map(pitchText).join(' ') : '';
  $('song-meta').textContent = [song.artist || 'Tablatura importada', tuning].filter(Boolean).join(' · ');
  for (const button of $('songs').querySelectorAll('button')) {
    const selected = button.dataset.song === song.id;
    button.dataset.active = selected;
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('.song-status').hidden = !selected;
  }
  reset();
}

function renderLibrary() {
  $('songs').replaceChildren();
  for (const entry of [...songs, ...imported]) {
    const button = document.createElement('button');
    button.className = 'song';
    button.dataset.song = entry.id;
    button.dataset.active = entry.id === song.id;
    button.setAttribute('aria-pressed', String(entry.id === song.id));
    button.innerHTML = '<span class="song-icon">' + musicIcon + '</span><span class="song-copy"><span class="song-name"></span><span class="song-meta-small"></span></span><span class="song-status" aria-hidden="true"></span>';
    button.querySelector('.song-name').textContent = entry.title;
    button.querySelector('.song-meta-small').textContent = entry.artist || 'Tablatura importada';
    button.querySelector('.song-status').hidden = entry.id !== song.id;
    button.addEventListener('click', () => selectSong(entry));
    $('songs').append(button);
  }
}

function context() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) throw new Error('Este navegador no ofrece audio web.');
  if (!audioContext || audioContext.state === 'closed') audioContext = new Audio();
  return audioContext;
}

function disconnectMic() {
  if (!input) return;
  const old = input;
  input = null;
  old.source.disconnect();
  old.filter.disconnect();
  old.stream.getTracks().forEach((track) => track.stop());
  updateActions();
}

async function connectMic() {
  if (input) {
    if (audioContext.state !== 'running') await audioContext.resume();
    return true;
  }
  if (opening) return false;
  opening = true;
  updateActions();
  let stream = null;
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Abre Pulso en una pestaña HTTPS o en localhost para usar el micrófono.');
    }
    const audio = context();
    const microphone = navigator.mediaDevices.getUserMedia({
      audio: { channelCount: { ideal: 1 }, echoCancellation: false, autoGainControl: false, noiseSuppression: false }
    });
    const resumed = audio.resume();
    resumed.catch(() => {});
    stream = await microphone;
    await resumed;
    const source = audio.createMediaStreamSource(stream);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 480;
    filter.Q.value = .24;
    const analyser = audio.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(filter).connect(analyser);
    input = { stream, source, filter, analyser, buffer: new Float32Array(analyser.fftSize) };
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      if (input?.stream !== stream) return;
      disconnectMic();
      if (active()) {
        phase = 'failed';
        $('practice').dataset.phase = phase;
        target.dataset.cue = 'false';
        feedback('Micrófono desconectado', 'Vuelve a conectarlo y pulsa Reiniciar.');
        updateActions();
      } else if (phase !== 'failed') feedback('Micrófono desconectado', 'Puedes volver a activarlo arriba.');
    });
    noise = .0015;
    attacks.reset();
    return true;
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    const deniedHint = window.top === window
      ? 'Permite el acceso al micrófono en tu navegador y vuelve a intentarlo.'
      : 'Abre Pulso en una pestaña propia y permite el acceso al micrófono.';
    const message = error.name === 'NotAllowedError' || error.name === 'SecurityError'
      ? deniedHint
      : error.name === 'NotFoundError' ? 'El navegador no encontró un micrófono.' : error.message;
    feedback('No pudimos activar el micrófono', message);
    return false;
  } finally {
    opening = false;
    updateActions();
  }
}

function readAudio(now, calibrating) {
  if (!input || now - lastAudioFrame < 15) return null;
  lastAudioFrame = now;
  const { analyser, buffer } = input;
  analyser.getFloatTimeDomainData(buffer);
  let energy = 0;
  for (let i = buffer.length - 768; i < buffer.length; i++) energy += buffer[i] ** 2;
  const volume = Math.sqrt(energy / 768);
  if (calibrating) noise = Math.min(.025, noise * .88 + volume * .12);
  const threshold = Math.max(.0023, noise * 2.1);
  const midi = volume >= threshold && phase === 'playing'
    ? detector.analyse(buffer, audioContext.sampleRate)
    : null;
  return attacks.read(midi, volume, threshold, now);
}

function scheduleFrame() {
  if (!frameId) frameId = requestAnimationFrame(frame);
}

function fail() {
  phase = 'failed';
  $('practice').dataset.phase = phase;
  target.dataset.cue = 'false';
  const { reason, heard, expected } = attempt.failure;
  showNote(attempt.index, 'NOTA ESPERADA');
  if (reason === 'pitch') {
    feedback('Nota incorrecta', 'Esperaba ' + pitchText(expected) + ' · Tocaste ' + pitchText(heard));
  } else if (reason === 'missing') {
    feedback('La nota no llegó a tiempo', 'Esperaba ' + pitchText(expected) + ' · Pulsa Reiniciar');
  } else {
    feedback(reason === 'early' ? 'Te adelantaste' : 'Llegaste tarde',
      'Esperaba ' + pitchText(expected) + ' · Detecté ' + pitchText(heard));
  }
  updateActions();
}

function showPlaying(now) {
  if (attempt.status === 'failed') {
    fail();
    return;
  }
  if (attempt.status === 'complete') {
    phase = 'complete';
    $('practice').dataset.phase = phase;
    target.dataset.cue = 'false';
    $('target-label').textContent = 'COMPLETADO';
    $('target-note').textContent = '✓';
    $('fingering').replaceChildren();
    $('position-hint').textContent = 'Todas las notas acertadas';
    renderFretboard(fretboard, null, Math.max(2, song.tuning?.length || 6));
    feedback('¡Canción completada!', 'Pulsa Reiniciar para repetirla.');
    updateProgress(song.notes.length);
    updateActions();
    return;
  }
  if (attempt.index !== lastIndex) {
    lastIndex = attempt.index;
    showNote(lastIndex, 'TOCA ESTA NOTA');
    updateProgress(lastIndex);
    feedback('', attempt.timed ? 'Toca cuando brille el pulso.' : 'Toca la nota para avanzar.');
  }
  const windowOpen = !attempt.timed || now >= attempt.due - 55 && now <= attempt.due + Math.min(135, attempt.tolerance);
  target.dataset.cue = String(windowOpen);
}

function frame(now) {
  frameId = 0;
  if (phase === 'counting' && now >= startAt - (attempt.timed ? Math.min(95, attempt.tolerance) : 0)) {
    phase = 'playing';
    $('practice').dataset.phase = phase;
    lastIndex = -1;
  }
  const heard = active() ? readAudio(now, phase === 'counting' && now < calmUntil) : null;
  if (phase === 'counting') {
    const nextCount = Math.max(1, Math.ceil((startAt - now) / beatLength));
    if (nextCount !== countdown) {
      countdown = nextCount;
      $('target-label').textContent = 'PREPÁRATE';
      $('target-note').textContent = countdown;
      $('position-hint').textContent = 'La primera nota es ' + pitchText(song.notes[0].midi);
    }
  }
  if (phase === 'playing') {
    if (heard) attempt.hear(heard.midi, heard.at);
    attempt.tick(now);
    showPlaying(now);
  }
  if (demo?.visual) {
    const elapsed = (audioContext.currentTime - demo.start) * demo.speed * 1000;
    let index = demo.visualIndex;
    while (song.notes[index + 1]?.time <= elapsed) index++;
    if (index !== demo.visualIndex) {
      demo.visualIndex = index;
      showNote(index, 'ESCUCHA LA NOTA');
    }
  }
  if (active() || demo?.visual) scheduleFrame();
}

async function begin() {
  if (active()) {
    reset('Intento detenido. Puedes volver a empezar.');
    return;
  }
  stopDemo();
  if (!await connectMic()) return;
  const speed = Number($('speed').value);
  const timed = $('mode').value === 'timed';
  beatLength = Math.min(1100, 60000 / (song.bpm * speed));
  const now = performance.now();
  startAt = now + beatLength * 3;
  calmUntil = now + Math.min(450, beatLength);
  attempt = new Attempt(song.notes, speed, timed, startAt);
  attacks.reset();
  countdown = 0;
  phase = 'counting';
  $('practice').dataset.phase = phase;
  target.dataset.cue = 'false';
  showNote(0, 'PRIMERA NOTA');
  updateProgress(0);
  feedback('', 'Deja el ambiente en silencio durante la cuenta.');
  updateActions();
  scheduleFrame();
}

function stopDemo() {
  if (!demo) return;
  clearTimeout(demo.timer);
  clearInterval(demo.scheduler);
  for (const oscillator of demo.playing) {
    try { oscillator.stop(); } catch {}
  }
  if (demo.visual) showNote(0, 'PRIMERA NOTA');
  demo = null;
  updateActions();
}

async function listen() {
  if (demo) {
    stopDemo();
    return;
  }
  try {
    const audio = context();
    await audio.resume();
    if (active() || opening || demo) return;
    const start = audio.currentTime + .07;
    const speed = Number($('speed').value);
    const notes = song.notes;
    demo = { timer: 0, scheduler: 0, playing: new Set(), visual: phase === 'idle', visualIndex: -1, start, speed };
    const playback = demo;
    let index = 0;
    function queue() {
      while (index < notes.length && start + notes[index].time / (speed * 1000) < audio.currentTime + .24) {
        const note = notes[index++];
        const at = Math.max(audio.currentTime, start + note.time / (speed * 1000));
        const duration = Math.max(.07, Math.min(.6, note.duration / (speed * 1000)));
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);
        gain.gain.setValueAtTime(.001, at);
        gain.gain.exponentialRampToValueAtTime(.11, at + .012);
        gain.gain.exponentialRampToValueAtTime(.001, at + duration);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(at);
        oscillator.stop(at + duration + .01);
        playback.playing.add(oscillator);
        oscillator.addEventListener('ended', () => {
          playback.playing.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        });
      }
    }
    queue();
    demo.scheduler = setInterval(queue, 90);
    const last = notes.at(-1);
    demo.timer = setTimeout(stopDemo, Math.min(2147483647, (last.time + last.duration) / speed + 160));
    if (demo.visual) scheduleFrame();
    updateActions();
  } catch {
    if (phase !== 'failed') feedback('Audio no disponible', 'Comprueba el volumen del navegador.');
  }
}

function addTrack(track) {
  const { title, artist } = currentImport;
  const entry = {
    id: crypto.randomUUID(), title: track.title || title,
    artist: track.artist || [artist, track.name].filter(Boolean).join(' · '),
    bpm: track.bpm, notes: track.notes, tuning: track.tuning
  };
  imported.push(entry);
  let saved = true;
  try { localStorage.setItem('pulso-songs', JSON.stringify(imported)); } catch { saved = false; }
  renderLibrary();
  selectSong(entry);
  $('import-message').textContent = saved
    ? 'En los acordes se practica la nota más grave.'
    : 'Disponible durante esta sesión. El almacenamiento está lleno o desactivado.';
}

async function importTab(file) {
  if (!file || active()) return;
  if (file.size > 10 * 1024 * 1024) {
    $('import-message').textContent = 'Elige un archivo de hasta 10 MB.';
    return;
  }
  importing = true;
  updateActions();
  $('import-message').textContent = 'Leyendo tablatura…';
  try {
    const { readTab } = await import('./import.mjs');
    const next = readTab(new Uint8Array(await file.arrayBuffer()), file.name);
    if (!next.tracks.length) {
      $('import-message').textContent = 'El archivo no tiene pistas con notas compatibles.';
      return;
    }
    if (active() || opening) {
      $('import-message').textContent = 'Detén el intento e importa el archivo de nuevo.';
      return;
    }
    currentImport = next;
    if (next.tracks.length === 1) {
      addTrack(next.tracks[0]);
      currentImport = null;
      return;
    }
    const select = $('track-select');
    select.replaceChildren(...next.tracks.map((track, index) => new Option(track.name + ' · ' + track.notes.length + ' notas', index)));
    const guitar = next.tracks.findIndex((track) => track.tuning.length === 6);
    select.selectedIndex = Math.max(0, guitar);
    $('import-message').textContent = '';
    $('track-dialog').returnValue = '';
    $('track-dialog').showModal();
  } catch {
    $('import-message').textContent = 'No pude leer el archivo. Prueba con una tablatura Guitar Pro o MusicXML sin protección.';
  } finally {
    importing = false;
    updateActions();
  }
}

$('mic-button').addEventListener('click', async () => {
  if (input) {
    disconnectMic();
    if (phase === 'idle') feedback('', idleHint);
  } else if (await connectMic() && phase === 'idle') {
    feedback('Micrófono activo', 'Pulsa Empezar cuando estés listo.');
  }
});
$('start').addEventListener('click', begin);
$('listen').addEventListener('click', listen);
$('speed').addEventListener('change', () => updateProgress(attempt?.index ?? 0));
$('mode').addEventListener('change', () => updateProgress(attempt?.index ?? 0));
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', () => {
  importTab($('file').files[0]);
  $('file').value = '';
});
$('track-dialog').addEventListener('close', () => {
  if (currentImport && $('track-dialog').returnValue === 'import') addTrack(currentImport.tracks[$('track-select').value]);
  currentImport = null;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && active()) {
    phase = 'failed';
    $('practice').dataset.phase = phase;
    target.dataset.cue = 'false';
    showNote(attempt.index, 'NOTA ESPERADA');
    feedback('Intento interrumpido', 'Pulsa Reiniciar para volver a la primera nota.');
    updateActions();
  }
});
window.addEventListener('pagehide', disconnectMic);

renderLibrary();
selectSong(song);
