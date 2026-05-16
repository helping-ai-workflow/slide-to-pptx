#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const tsxCli = require.resolve('tsx/cli');
const entry = path.resolve(__dirname, '..', 'src', 'cli.ts');

const r = spawnSync(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], {
    stdio: 'inherit',
});
process.exit(r.status ?? 1);
