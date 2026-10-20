#!/usr/bin/env node
/**
 * Packages the production web build and the Manifest V3 extension into
 * extension/dist, ready for chrome://extensions → Load unpacked.
 */
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const extensionDir = join(root, 'extension');
const output = join(extensionDir, 'dist');

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(join(dist, 'index.html')))) {
    throw new Error('dist/index.html is missing. Run `npm run build` first.');
  }

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  // Copy the complete production app (JS, CSS, icons, news data).
  await cp(dist, output, { recursive: true });
  await cp(join(extensionDir, 'manifest.json'), join(output, 'manifest.json'));
  await cp(join(extensionDir, 'options.html'), join(output, 'options.html'));
  await cp(join(extensionDir, 'options.css'), join(output, 'options.css'));
  await cp(join(extensionDir, 'options.js'), join(output, 'options.js'));

  const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
  const required = [
    'manifest.json',
    'index.html',
    'options.html',
    'options.js',
    'options.css',
    'icons/icon-16.png',
    'icons/icon-32.png',
    'icons/icon-48.png',
    'icons/icon-128.png',
    'data/news.json',
  ];

  for (const file of required) {
    if (!(await exists(join(output, file)))) {
      throw new Error(`Extension is missing required file: ${file}`);
    }
  }

  if (manifest.manifest_version !== 3) {
    throw new Error('Extension manifest must be Manifest V3.');
  }
  if (manifest.chrome_url_overrides?.newtab !== 'index.html') {
    throw new Error('Manifest must override the new-tab page with index.html.');
  }

  const assets = JSON.parse(
    await readFile(join(root, 'package.json'), 'utf8'),
  );
  if (manifest.version !== assets.version) {
    throw new Error(
      `Manifest version (${manifest.version}) does not match package version (${assets.version}).`,
    );
  }

  await writeFile(
    join(output, 'INSTALL.txt'),
    [
      'RetroPortal browser extension',
      '',
      '1. Open chrome://extensions (or edge://extensions, brave://extensions).',
      '2. Turn on Developer mode.',
      '3. Choose "Load unpacked" and select this extension/dist folder.',
      '4. Open a new tab.',
      '5. Use the extension Details → Extension options page to choose bundled or hosted mode.',
      '',
      'The app runs entirely from files inside this folder. No dev server is required.',
      '',
    ].join('\n'),
  );

  console.log(`Extension packaged in ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
