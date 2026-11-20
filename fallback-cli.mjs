#!/usr/bin/env node
import util from 'node:util';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import hideSensitive from 'semantic-release/lib/hide-sensitive.js';
import runFallback from './fallback-runner.mjs';

// The public semantic-release API accepts an options object, not argv.
// Keep CLI parsing outside the fallback runner and delegate to upstream yargs.
const list = { type: 'string', array: true, coerce: values =>
  values.length === 1 && values[0].trim() === 'false'
    ? [] : values.flatMap(value => value.split(',').map(item => item.trim())) };
const cli = yargs(hideBin(process.argv))
  .alias({ b: 'branches', r: 'repository-url', t: 'tag-format',
    p: 'plugins', e: 'extends', d: 'dry-run' })
  .option('ci', { type: 'boolean' })
  .option('dry-run', { type: 'boolean' })
  .option('debug', { type: 'boolean' })
  .option('analyze-commits', { type: 'string' })
  .options(Object.fromEntries([
    'branches', 'plugins', 'extends', 'verify-conditions', 'verify-release',
    'generate-notes', 'prepare', 'publish', 'success', 'fail',
  ].map(name => [name, list])))
  .parserConfiguration({ 'strip-dashed': true, 'strip-aliased': true })
  .strict(false)
  .exitProcess(false);

try {
  const { help, version, _, $0, ...options } = cli.parse();
  if (!help && !version) await runFallback(options);
} catch (error) {
  process.stderr.write(hideSensitive(process.env)(util.inspect(error, { colors: true })) + '\n');
  process.exitCode = 1;
}
