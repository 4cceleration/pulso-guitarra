const WIDTH = 760;
const HEIGHT = 270;
const CENTER = 180;
const LEFT = 15;
const LENGTH_SCALE = 1.78;
const CROSS_SCALE = 1.18;
const NUT = 55;
const END = 320;
const BRIDGE = 394;
const ROWS = 9;

const halfWidth = (y) => 49 + 20 * Math.min(1, Math.max(0, (y - NUT) / (END - NUT)));
const stringX = (string, count, y) => CENTER + (1 - 2 * (string - 1) / (count - 1)) * (halfWidth(y) - 11);
const fretY = (row) => NUT + (END - NUT) * (1 - .96 ** row) / (1 - .96 ** ROWS);
const horizontalPoint = (x, y) => [LEFT + y * LENGTH_SCALE, HEIGHT / 2 + (CENTER - x) * CROSS_SCALE];

function outline(ctx, shape, fill, stroke, width = 1) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(shape);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke(shape);
  }
}

function line(ctx, x1, y1, x2, y2, color, width) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function circle(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function paintBody(ctx, hasGuitarHardware) {
  const shell = new Path2D('M145 316 C127 317 118 303 106 287 C96 272 89 268 81 272 C72 276 74 291 68 307 C61 326 40 334 32 358 C16 403 49 453 126 468 C196 482 286 463 317 417 C338 385 318 352 290 337 C272 327 265 322 267 302 C269 286 259 282 250 291 C237 303 232 320 214 322 Z');
  const enamel = ctx.createLinearGradient(42, 270, 282, 426);
  enamel.addColorStop(0, '#ffffff');
  enamel.addColorStop(.52, '#f8f8f8');
  enamel.addColorStop(1, '#dedee0');
  ctx.save();
  ctx.shadowColor = '#17171c1c';
  ctx.shadowBlur = 21;
  ctx.shadowOffsetY = 8;
  outline(ctx, shell, enamel, '#c4c4c8', 2);
  ctx.restore();
  outline(ctx, shell, null, '#ffffff', .75);

  const pickguard = new Path2D('M114 325 C129 335 225 333 239 317 C245 311 247 310 250 314 C252 322 247 328 262 337 C284 351 300 362 301 384 C301 403 279 423 251 438 L89 437 C76 431 75 423 79 412 L98 373 C102 366 98 353 100 345 C102 336 106 327 114 325 Z');
  outline(ctx, pickguard, '#fbfbfb', '#bfbfc4', 1.25);
  for (const [x, y] of [[109, 344], [90, 412], [249, 328], [286, 373], [263, 418]]) {
    circle(ctx, x, y, 2.15, '#bcbcc1');
    line(ctx, x - 1, y + .7, x + 1, y - .7, '#77777e', .7);
  }
  if (hasGuitarHardware) {
    circle(ctx, 269, 392, 10, '#cacace');
    circle(ctx, 269, 390, 8.7, '#fff');
    circle(ctx, 287, 408, 7.5, '#eee');
  }
}

function paintNeck(ctx, firstFret) {
  const neck = new Path2D(`M${CENTER - halfWidth(NUT)} ${NUT - 1} L${CENTER + halfWidth(NUT)} ${NUT - 1} L${CENTER + halfWidth(END)} 327 Q${CENTER + halfWidth(END)} 335 ${CENTER + halfWidth(END) - 9} 335 H${CENTER - halfWidth(END) + 9} Q${CENTER - halfWidth(END)} 335 ${CENTER - halfWidth(END)} 327 Z`);
  const wood = ctx.createLinearGradient(CENTER - 69, 0, CENTER + 69, 0);
  wood.addColorStop(0, '#303034');
  wood.addColorStop(.12, '#46464a');
  wood.addColorStop(.5, '#37373b');
  wood.addColorStop(.9, '#444449');
  wood.addColorStop(1, '#28282d');
  outline(ctx, neck, wood, '#9f9fa5', 1.8);

  for (let row = 1; row <= ROWS; row++) {
    const y = fretY(row);
    const width = halfWidth(y);
    line(ctx, CENTER - width + .5, y + .8, CENTER + width - .5, y + .8, '#0b0b0c80', 2.8);
    line(ctx, CENTER - width + .5, y, CENTER + width - .5, y, '#c1c1c6', 1.35);
    const fret = firstFret + row - 1;
    const middle = (fretY(row - 1) + y) / 2;
    const inlay = fret % 12;
    if ([3, 5, 7, 9].includes(inlay)) circle(ctx, CENTER, middle, 3.5, '#afafb4');
    if (inlay === 0) {
      circle(ctx, CENTER - width * .38, middle, 3.5, '#afafb4');
      circle(ctx, CENTER + width * .38, middle, 3.5, '#afafb4');
    }
  }
  line(ctx, CENTER - halfWidth(NUT), NUT, CENTER + halfWidth(NUT), NUT, firstFret === 1 ? '#ececed' : '#a0a0a7', firstFret === 1 ? 4 : 1.3);
}

function paintHardware(ctx, strings) {
  for (const y of [343, 366]) {
    const pickup = new Path2D(`M113 ${y - 6} H246 Q250 ${y - 6} 250 ${y - 2} V${y + 3} Q250 ${y + 7} 246 ${y + 7} H113 Q109 ${y + 7} 109 ${y + 3} V${y - 2} Q109 ${y - 6} 113 ${y - 6} Z`);
    outline(ctx, pickup, '#eaeaec', '#b4b4b9');
    for (let string = 1; string <= strings; string++) circle(ctx, stringX(string, strings, y), y, 2.3, '#a0a0a6');
  }
  outline(ctx, new Path2D('M112 386 H248 V405 Q248 410 243 410 H117 Q112 410 112 405 Z'), '#b7b7be', '#8e8e95', 1.2);
  line(ctx, 116, 388, 244, 388, '#e8e8ec', 1);
  for (let string = 1; string <= strings; string++) {
    const x = stringX(string, strings, BRIDGE);
    ctx.fillStyle = '#dddee0';
    ctx.fillRect(x - 4.5, BRIDGE - 3, 9, 12);
    line(ctx, x - 4, BRIDGE + 7, x + 4, BRIDGE + 7, '#77777d', 1);
  }
}

export function renderFretboard(board, note, strings = 6) {
  const canvas = board.querySelector('canvas');
  const marker = board.querySelector('.fret-marker');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const hasPosition = Number.isInteger(note?.string) && note.string > 0 && Number.isInteger(note.fret) && note.fret >= 0;
  const activeString = hasPosition ? note.string : 0;
  const fret = hasPosition ? note.fret : 0;
  const firstFret = 1 + Math.max(0, Math.ceil((fret - ROWS) / (ROWS - 2))) * (ROWS - 2);

  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.transform(0, -CROSS_SCALE, LENGTH_SCALE, 0, LEFT, HEIGHT / 2 + CENTER * CROSS_SCALE);
  paintBody(ctx, strings >= 6);
  paintNeck(ctx, firstFret);
  paintHardware(ctx, strings);

  for (let string = 1; string <= strings; string++) {
    const x = stringX(string, strings, NUT);
    const selected = string === activeString;
    const weight = .75 + (string - 1) / (strings - 1) * 1;
    if (selected) line(ctx, x, 43, stringX(string, strings, END), END, '#d7fc7254', 5);
    line(ctx, x, 48, stringX(string, strings, END), END, selected ? '#e5ff9e' : '#c4c4ca', selected ? 2.1 : weight);
    line(ctx, stringX(string, strings, END), END, stringX(string, strings, BRIDGE), BRIDGE + 5, '#898990', weight);
  }
  ctx.restore();

  ctx.font = '600 14px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let string = 1; string <= strings; string++) {
    const [x, y] = horizontalPoint(stringX(string, strings, NUT), 23);
    const selected = string === activeString;
    if (selected) circle(ctx, x, y, 9, '#d7fc72');
    ctx.fillStyle = selected ? '#182321' : '#536358';
    ctx.fillText(string, x, y);
  }

  for (let row = firstFret === 1 ? 0 : 1; row <= ROWS; row++) {
    const label = row === 0 ? 0 : firstFret + row - 1;
    const length = row === 0 ? NUT - 13 : (fretY(row) + fretY(row - 1)) / 2;
    const [x, y] = horizontalPoint(CENTER + halfWidth(length) + 20, length);
    const selected = hasPosition && label === fret;
    if (selected) circle(ctx, x, y, 10.5, '#d7fc72');
    ctx.fillStyle = selected ? '#182321' : '#536358';
    ctx.fillText(label, x, y);
  }

  marker.hidden = !hasPosition;
  const layout = firstFret + '/' + strings;
  marker.dataset.snap = String(board.dataset.layout !== layout);
  board.dataset.layout = layout;
  if (hasPosition) {
    const row = fret - firstFret + 1;
    const length = fret === 0 ? NUT - 13 : fretY(row - 1) + .72 * (fretY(row) - fretY(row - 1));
    const [x, y] = horizontalPoint(stringX(activeString, strings, length), length);
    marker.style.left = x / WIDTH * 100 + '%';
    marker.style.top = y / HEIGHT * 100 + '%';
  }
}
