import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

test('root package.json dependencies match server (cPanel installs only from the app root)', () => {
  const root = readJson(path.join(here, '..', '..', 'package.json'));
  const server = readJson(path.join(here, '..', 'package.json'));
  assert.deepEqual(root.dependencies, server.dependencies);
});
