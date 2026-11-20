#!/usr/bin/env node
import { createRequire } from 'node:module';
import semanticRelease from 'semantic-release';
import { SEMANTIC_RELEASE_DEFAULT_CONFIG } from 'semantic-release/lib/definitions/constants.js';
import hideSensitive from 'semantic-release/lib/hide-sensitive.js';
import util from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const require = createRequire(import.meta.url);
const releaseRequire = createRequire(require.resolve('semantic-release'));
const core = await import(pathToFileURL(releaseRequire.resolve('@semantic-release/core')).href);
// Normal release and validation share this invocation, including the
// semantic-release 26 workaround that gives the fallback policy precedence.
export function bundledReleaseOptions(options = {}) {
  return { ...require('./fallback-config.cjs'), ...options };
}

export async function runRelease(options = {}, runtime = {}, { fallback = false, transform } = {}) {
  const invocation = fallback ? bundledReleaseOptions(options) : options;
  if (!transform) return semanticRelease(invocation, runtime);

  // Resolve the real effective configuration (including extends), then apply
  // validation-only overrides before invoking the exact same public API.
  const context = {
    cwd: runtime.cwd ?? process.cwd(),
    env: runtime.env ?? process.env,
    stdout: runtime.stdout ?? process.stdout,
    stderr: runtime.stderr ?? process.stderr,
  };
  context.logger = core.getLogger(context);
  const resolved = await core.resolveConfig(context, invocation, {
    baseConfig: SEMANTIC_RELEASE_DEFAULT_CONFIG,
    buildPlugins: false,
  });
  return semanticRelease(transform(resolved.options), runtime);
}

export function runBundledRelease(options = {}, runtime = {}) {
  return runRelease(options, runtime, { fallback: true });
}
const list = { type: 'string', array: true, coerce: values =>
  values.length === 1 && values[0].trim() === 'false'
    ? [] : values.flatMap(value => value.split(',').map(item => item.trim())) };

// Importing this module for validation must not run the CLI.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
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
    try {
      await runBundledRelease(options);
    } catch (error) {
      // Match the CLI's secret redaction, including credential-bearing Git URLs.
      process.stderr.write(hideSensitive(process.env)(util.inspect(error, { colors: true })));
      process.exitCode = 1;
    }
  }
  
}
