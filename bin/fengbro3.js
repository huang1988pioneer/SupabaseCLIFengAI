#!/usr/bin/env node
import { main } from '../src/cli.js';

const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  process.stderr.write(`鋒兄 CLI 需要 Node.js 18 以上（目前 ${process.version}）\n`);
  process.exit(1);
}

// 被 head / less 等提前關閉管線時，安靜結束。
process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
