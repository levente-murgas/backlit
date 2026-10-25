const assert = require('assert');
const { packet } = require('./dxlight');

// First packet uses seq 2, like the app's ID counter. Brightness 100:
// 'R' 'B' len=7 seq=2 cmd=135 100, checksum (82+66+7+2+135+100) % 256 = 136
assert.deepStrictEqual(packet(135, [100]), [82, 66, 7, 2, 135, 100, 136]);
assert.strictEqual(packet(151).length, 6);

// pulse keeps writing frames until any other command (here 'stop') arrives
const { run } = require('./dxlight');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const writes = [];
  const dev = { write: f => writes.push(f) };
  const done = run(dev, ['pulse', 'ff0000,0000ff', '1']);
  await sleep(300);
  assert(writes.length >= 5, `pulse wrote ${writes.length} frames`);
  await run(dev, ['stop']);
  await done;
  const n = writes.length;
  await sleep(150);
  assert.strictEqual(writes.length, n, 'pulse kept writing after stop');

  // colour cycle starts on pure red (frame = [0, 'R', 'B', len, seq, cmd, start, r, g, b, end, sum])
  writes.length = 0;
  const cycling = run(dev, ['cycle', '30']);
  await sleep(50);
  // brightness must not stop the animation
  await run(dev, ['brightness', '100']);
  const m = writes.length;
  await sleep(100);
  assert(writes.length > m, 'cycle stopped after brightness');
  await run(dev, ['stop']);
  await cycling;
  assert.deepStrictEqual(writes[0].slice(7, 10), [255, 0, 0]);
  console.log('ok');
})();
