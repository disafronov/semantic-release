#!/usr/bin/env node
import { createRequire } from 'node:module';
import semanticRelease from 'semantic-release';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const require = createRequire(import.meta.url);
const bundled = require('./default.releaserc.cjs');
const list = { type: 'string', array: true, coerce: values =>
  values.length === 1 && values[0].trim() === 'false'
    ? [] : values.flatMap(value => value.split(',').map(item => item.trim())) };

const argv = yargs(hideBin(process.argv))
  .option('b', { alias: 'branches', ...list })
  .option('r', { alias: 'repository-url', type: 'string' })
  .option('t', { alias: 'tag-format', type: 'string' })
  .option('p', { alias: 'plugins', ...list })
  .option('e', { alias: 'extends', ...list })
  .option('ci', { type: 'boolean' })
  .option('verify-conditions', { ...list })
  .option('analyze-commits', { type: 'string' })
  .option('verify-release', { ...list })
  .option('generate-notes', { ...list })
  .option('prepare', { ...list })
  .option('publish', { ...list })
  .option('success', { ...list })
  .option('fail', { ...list })
  .option('debug', { type: 'boolean' })
  .option('d', { alias: 'dry-run', type: 'boolean' })
  .option('h', { alias: 'help' })
  .strict(false)
  .exitProcess(false)
  .parse();

if (!argv.help && !argv.version) {
  // semantic-release 26 supplies built-in plugins as baseConfig. These take
  // priority over plugins supplied only via --extends. Runtime options win.
  // Pass the full policy (including per-plugin configuration) as runtime options.
  const { help, version, _, $0, ...options } = argv;
  await semanticRelease({ ...bundled, ...options });
}
