#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { detectReleaseConfig } from './detect-release-config.mjs';

const require = createRequire(import.meta.url);
const releaseRequire = createRequire(require.resolve('semantic-release'));

function pluginName(entry) {
  const plugin = Array.isArray(entry) ? entry[0] : entry;
  return typeof plugin === 'string' ? plugin : plugin?.path ?? 'inline plugin';
}

async function main() {
  const [repositoryUrl] = process.argv.slice(2);
  if (!repositoryUrl) throw new Error('Validation worker requires a local repository URL');

  const core = await import(pathToFileURL(releaseRequire.resolve('@semantic-release/core')).href);
  const { SEMANTIC_RELEASE_DEFAULT_CONFIG } = await import('semantic-release/lib/definitions/constants.js');
  const cwd = process.cwd();
  const env = process.env;
  const context = {
    cwd, env,
    envCi: core.resolveEnvCi({ cwd, env }),
    stdout: process.stdout,
    stderr: process.stderr,
  };
  context.logger = core.getLogger(context);

  const detected = detectReleaseConfig(cwd);
  const fallback = detected.kind === 'fallback' ? require('./fallback-config.cjs') : {};
  if (detected.kind === 'fallback') {
    console.log('No local semantic-release configuration found, using default');
  } else {
    console.log('Using project semantic-release configuration: ' + detected.path);
  }

  // Runtime overrides are authoritative. A project config cannot redirect
  // validation to an external Git remote or turn prepare into a dry run.
  const runtimeOptions = {
    ...fallback,
    repositoryUrl,
    dryRun: false,
    noCi: false,
    ci: true,
  };
  const { options, plugins } = await core.resolveConfig(context, runtimeOptions, {
    baseConfig: SEMANTIC_RELEASE_DEFAULT_CONFIG,
    buildPlugins: true,
  });
  context.options = options;

  console.log('Active plugins: ' + options.plugins.map(pluginName).join(', '));

  // Preserve the upstream-resolved pipeline, including inline plugins and
  // shareable-config resolution. Only release-to-external-service stages are
  // replaced. verifyConditions may require publish credentials or network.
  const skipped = async () => [];
  const validationPlugins = {
    ...plugins,
    verifyConditions: skipped,
    publish: skipped,
    addChannel: skipped,
    success: skipped,
    fail: skipped,
  };

  const result = await core.default({ context, plugins: validationPlugins });
  console.log('Validation completed (local prepare and Git only; external publishing disabled).');
  if (result?.nextRelease?.version) {
    console.log('Prepared version: ' + result.nextRelease.version);
  }
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
