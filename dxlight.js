#!/usr/bin/env node
// Minimal DX Light (Robobloq, VID 0x1A86 / PID 0xFE07) controller.
// Protocol recovered from DX Light 3.7.21 (.webpack/main modules 5786 + 60895):
//   HID report 0, packet = "RB" | len | seq | cmd | payload... | sum(bytes) % 256
const HID = require('node-hid');

const VID = 6790, PID = 65031;
const CMD = { sectionLED: 134, ledEffect: 133, brightness: 135, dynamicSpeed: 138 };

let seq = 1;
function packet(cmd, payload = []) {
  seq = seq + 1 >= 255 ? 1 : seq + 1;
  const len = 6 + payload.length;
  const bytes = [0x52, 0x42, len, seq, cmd, ...payload];
  bytes.push(bytes.reduce((a, b) => a + b, 0) % 256);
  return bytes;
}

function open() {
  const info = HID.devices().find(d => d.vendorId === VID && d.productId === PID && d.interface === 0);
  if (!info) throw new Error('DX Light strip not found (is it plugged in?)');
  try { return new HID.HID(info.path); } catch (e) {
    if (/exclusive access/.test(e.message)) throw new Error('Strip is in use by another program (DX Light app, or a dxlight pulse still running in a terminal)');
    throw e;
  }
}

const hex = s => {
  if (!/^#?[0-9a-f]{6}$/i.test(s)) throw new Error(`bad colour: ${s}`);
  const v = parseInt(s.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
// [start, r, g, b, end] covers LEDs start..end; the app uses 1..254 for "whole strip".
const color = ([r, g, b]) => packet(CMD.sectionLED, [1, r, g, b, 254]);

const RAINBOW = 'ff0000,ff8000,ffff00,00ff00,00ffff,0000ff,ff00ff';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Software animations: frame(seconds) -> rgb, written at fps until the next command.
// Bumping pulseRun stops a running animation before its next frame.
let pulseRun = 0;
const stopPulse = () => pulseRun++;
async function animate(dev, frame, fps = 30) {
  const run = ++pulseRun, t0 = Date.now();
  while (run === pulseRun) {
    dev.write([0, ...color(frame((Date.now() - t0) / 1000))]);
    await sleep(1000 / fps);
  }
}

// One fade in/out per colour, then move to the next colour (like firmware effect 1).
const pulse = (dev, colours, periodSec) => animate(dev, t => {
  const cycles = t / periodSec;
  const rgb = colours[Math.floor(cycles) % colours.length];
  const level = ((1 - Math.cos(2 * Math.PI * (cycles % 1))) / 2) ** 2.2; // gamma so the dim end isn't rushed
  return rgb.map(c => Math.round(c * level));
});

// Fully saturated hue (0..1) -> rgb, i.e. HSL with s = 1, l = 0.5
const hue = h => [0, 8, 4].map(n => {
  const k = (n + h * 12) % 12;
  return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
});
const cycle = (dev, periodSec) => animate(dev, t => hue((t / periodSec) % 1));

const USAGE = `usage: dxlight <command>
  color <hex>               solid colour, e.g. color ff4400
  brightness <5-255>        hardware brightness
  effect <0-6> [hex] [speed] firmware animation (app's "dynamic" buttons, left to right),
                            optional colour and speed (0-255, higher = slower)
  speed <0-255>             firmware animation speed byte (app only sends 0-100; higher = slower)
  pulse <hex[,hex...]|multi> <seconds>
                            software pulse, any period; with several colours each
                            gets one fade in/out in turn. Runs until Ctrl-C
  cycle <seconds>           software sweep through every hue, one full turn per <seconds>
  off                       turn off`;

// Runs one command; for 'pulse'/'cycle' the returned promise only settles once the animation is stopped.
// Brightness leaves a running animation alone: its next frames pick up the new level.
async function run(dev, [cmd, a, b, c]) {
  const send = p => dev.write([0, ...p]);
  if (cmd !== 'brightness') stopPulse();
  switch (cmd) {
    case 'color': send(color(hex(a))); break;
    case 'brightness': send(packet(CMD.brightness, [Math.max(5, Math.min(255, +a))])); break;
    case 'effect': {
      // optional args in any order: 6-digit hex = colour, number = speed
      const rest = [b, c].filter(Boolean);
      const rgb = rest.find(x => /^#?[0-9a-f]{6}$/i.test(x));
      const speed = rest.find(x => x !== rgb);
      if (rgb) { send(color(hex(rgb))); await sleep(50); }
      send(packet(CMD.ledEffect, [2, +a]));
      // speed is one global firmware setting, so it's (re)sent with each effect
      if (speed !== undefined) { await sleep(50); send(packet(CMD.dynamicSpeed, [Math.max(0, Math.min(255, +speed))])); }
      break;
    }
    case 'speed': send(packet(CMD.dynamicSpeed, [Math.max(0, Math.min(255, +a))])); break;
    case 'pulse': return pulse(dev, (a === 'multi' ? RAINBOW : a).split(',').map(hex), Math.max(0.5, +b || 10));
    case 'cycle': return cycle(dev, Math.max(1, +a || 120));
    // cmd 151 only exists on firmware >= 1.8.0; black works everywhere (same fallback as the app)
    case 'off': send(color([0, 0, 0])); break;
    case 'stop': return; // stopPulse() above already did it
    default: throw new Error(`unknown command: ${cmd}`);
  }
  await sleep(50);
}

async function main(args) {
  if (!args[0]) return console.log(USAGE);
  const dev = open();
  process.on('SIGINT', () => { dev.close(); process.exit(0); });
  await run(dev, args);
  dev.close();
}

module.exports = { packet, open, run, stopPulse, RAINBOW };
if (require.main === module) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
