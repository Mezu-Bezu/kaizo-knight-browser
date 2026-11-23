import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { result[key] = next; i++; }
    else result[key] = true;
  }
  return result;
}

function requireFile(file, label) {
  if (!file || typeof file !== 'string' || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`${label} not found: ${file ?? '(not supplied)'}`);
  }
}

function requireDir(dir, label) {
  if (!dir || typeof dir !== 'string' || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(`${label} directory not found: ${dir ?? '(not supplied)'}`);
  }
}

function validateGameMakerData(file, label) {
  requireFile(file, label);
  const data = fs.readFileSync(file);
  if (data.length < 16 || data.toString('ascii', 0, 4) !== 'FORM' ||
      data.toString('ascii', 8, 12) !== 'GEN8') {
    throw new Error(`${label} is not a recognizable GameMaker FORM/GEN8 data file.`);
  }
  const declaredSize = data.readUInt32BE(4);
  if (declaredSize !== data.length - 8) {
    throw new Error(`${label} has an inconsistent FORM size (header: ${declaredSize}, actual: ${data.length - 8}).`);
  }
  return data;
}

const args = readArgs(process.argv.slice(2));
const patchedWinMode = Boolean(args['patched-win']);
for (const key of ['game', 'normal', 'weird', 'runtime']) {
  if (!args[key]) throw new Error(`Missing --${key}`);
}
if (!patchedWinMode && !args.utmt) {
  throw new Error('Missing --utmt. Use --patched-win <path> to skip the old UndertaleModTool patch step.');
}

const gameDir = path.resolve(args.game);
const chapter = path.join(gameDir, 'chapter3_windows');
const musicDir = path.join(gameDir, 'mus');
const runtimeDir = path.resolve(args.runtime);
const out = path.join(root, 'dist/runtime');
const build = path.join(root, '.build');

requireDir(gameDir, 'Game');
requireDir(chapter, 'chapter3_windows');
requireDir(musicDir, 'Game music');
requireDir(runtimeDir, 'Runtime');
requireFile(args.normal, 'Normal save');
requireFile(args.weird, 'Weird save');
requireFile(path.join(chapter, 'audiogroup1.dat'), 'audiogroup1.dat');
requireFile(path.join(chapter, 'options.ini'), 'options.ini');
requireFile(path.join(chapter, 'lang/lang_ja.json'), 'lang/lang_ja.json');
if (!patchedWinMode) requireFile(path.join(chapter, 'data.win'), 'Original data.win');

for (const name of ['runner.js', 'runner.wasm', 'audio-worklet.js']) {
  requireFile(path.join(runtimeDir, name), `Runtime ${name}`);
}
const wasmHeader = fs.readFileSync(path.join(runtimeDir, 'runner.wasm')).subarray(0, 4);
if (!wasmHeader.equals(Buffer.from([0x00, 0x61, 0x73, 0x6d]))) {
  throw new Error('Runtime runner.wasm does not have the WebAssembly magic header.');
}
if (fs.statSync(path.join(runtimeDir, 'audio-worklet.js')).size === 0) {
  throw new Error('Runtime audio-worklet.js is empty.');
}

const normal = fs.readFileSync(args.normal, 'utf8').trimEnd().split(/\r?\n/);
const weird = fs.readFileSync(args.weird, 'utf8').trimEnd().split(/\r?\n/);
if (normal.length !== 3055 || weird.length !== 3055) {
  throw new Error(`Expected Chapter 3 saves with 3055 lines (Normal: ${normal.length}, Weird: ${weird.length}).`);
}
const weirdFlagIndex = 552 + 456;
const weirdFlag = Number(weird[weirdFlagIndex]);
if (weirdFlag !== 1) {
  throw new Error(`Weird Route save rejected: flag 456 at legacy line index ${weirdFlagIndex} must be 1 (found ${weird[weirdFlagIndex]}).`);
}

// Preserve the existing browser project's Weird Route save preparation.
weird[7] = '1';
weird[8] = '2';
weird[9] = '4';
for (let i = 0; i < 13; i++) weird[329 + 2 * i] = normal[329 + 2 * i];
const weirdData = Buffer.from(weird.join('\n') + '\n');

fs.mkdirSync(path.join(root, 'dist/saves'), {recursive: true});
fs.writeFileSync(path.join(root, 'dist/saves/weird-route-filech3_1'), weirdData);

let gameDataPath;
if (patchedWinMode) {
  gameDataPath = path.resolve(args['patched-win']);
  validateGameMakerData(gameDataPath, 'Patched game data');
  console.log(`Using supplied patched game data: ${gameDataPath}`);
} else {
  const utmt = path.resolve(args.utmt);
  requireFile(utmt, 'UndertaleModTool CLI');
  const generated = path.join(build, 'knight.win');
  fs.mkdirSync(build, {recursive: true});
  const result = spawnSync(utmt, [
    'load', path.join(chapter, 'data.win'), '-s',
    path.join(root, 'scripts/patch-knight.csx'), '-o', generated, '-f'
  ], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Game-data patch failed.');
  validateGameMakerData(generated, 'Generated patched game data');
  gameDataPath = generated;
}

let offset = 0;
const files = [];
const buffers = [];
function pack(name, data) {
  buffers.push(data);
  files.push({filename: '/assets/' + name, start: offset, end: offset + data.length, audio: 0});
  offset += data.length;
}

for (const name of ['audiogroup1.dat', 'options.ini', 'lang/lang_ja.json']) {
  pack(name, fs.readFileSync(path.join(chapter, name)));
}
pack('knight-normal.sav', fs.readFileSync(args.normal));
pack('knight-weird.sav', weirdData);

fs.mkdirSync(path.join(out, 'mus'), {recursive: true});
for (const name of fs.readdirSync(musicDir)) {
  if (!/knight|kaizo|dontforget|gameover/i.test(name)) continue;
  const data = fs.readFileSync(path.join(musicDir, name));
  fs.writeFileSync(path.join(out, 'mus', name), data);
  if (/knight|kaizo|gameover/i.test(name)) pack('mus/' + name, data);
}
fs.writeFileSync(path.join(out, 'runner.data'), Buffer.concat(buffers));

let runner = fs.readFileSync(path.join(runtimeDir, 'runner.js'), 'utf8');
const metadata = /\{"files":\[.*?"package_uuid":"[^"]+"\}/s;
if (!metadata.test(runner)) {
  throw new Error('Unsupported runner package metadata. The supplied runtime may not match this browser project.');
}
runner = runner.replace(metadata, JSON.stringify({
  files, remote_package_size: offset,
  package_uuid: args['package-uuid'] || 'kaizo-knight-v300'
}));
fs.writeFileSync(path.join(out, 'runner.js'), runner);

for (const name of ['runner.wasm', 'audio-worklet.js']) {
  fs.copyFileSync(path.join(runtimeDir, name), path.join(out, name));
}
for (const name of fs.readdirSync(chapter)) {
  if (name.toLowerCase().endsWith('.ogg')) {
    fs.copyFileSync(path.join(chapter, name), path.join(out, name.toLowerCase()));
  }
}

for (const name of fs.readdirSync(out)) {
  if (/^game\.part\d+$/.test(name)) fs.rmSync(path.join(out, name));
}
const gameData = fs.readFileSync(gameDataPath);
const parts = [];
const chunkSize = 20 * 1024 * 1024;
for (let pos = 0, index = 1; pos < gameData.length; pos += chunkSize, index++) {
  const name = 'game.part' + index;
  fs.writeFileSync(path.join(out, name), gameData.subarray(pos, pos + chunkSize));
  parts.push(name);
}
fs.writeFileSync(path.join(out, 'game-manifest.json'),
  JSON.stringify({parts, totalBytes: gameData.length}));

console.log(`Browser data prepared from ${patchedWinMode ? 'supplied patched data' : 'legacy patch pipeline'}.`);
console.log('This is a build step only. Runtime compatibility and both routes still require in-browser testing.');
