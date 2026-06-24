import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

function patchFile(path, replacements) {
  let source = readFileSync(path, 'utf8');
  let patched = source;

  for (const [from, to] of replacements) {
    if (patched.includes(from)) {
      patched = patched.replaceAll(from, to);
      continue;
    }
    if (!patched.includes(to)) {
      throw new Error(`Could not patch ${path}; expected text not found.`);
    }
  }

  if (patched !== source) {
    writeFileSync(path, patched);
    console.log(`Patched ${path}`);
  }
}

const cliPackage = require.resolve('@devvit/cli/package.json');
const cliRoot = dirname(cliPackage);
const buildPackPackage = require.resolve('@devvit/build-pack/package.json');
const buildPackRoot = dirname(buildPackPackage);
const startPackage = require.resolve('@devvit/start/package.json');
const startRoot = dirname(startPackage);

patchFile(join(cliRoot, 'dist/util/Bundler.js'), [
  ["minify: 'None',", "minify: 'All',"],
]);

patchFile(join(buildPackRoot, 'esbuild/ESBuildPack.js'), [
  ['minify: false,', 'minify: true,'],
  ["sourcemap: 'external',", 'sourcemap: false,'],
  ['return { code, sourceMap };', "return { code, sourceMap: '' };"],
]);

patchFile(join(startRoot, 'vite/index.js'), [
  [
    "                                sourcemapFileNames: '[name].js.map',",
    '                                // sourcemapFileNames omitted for Vite 8 compatibility',
  ],
  [
    '                                inlineDynamicImports: true,',
    '                                codeSplitting: false,',
  ],
]);
