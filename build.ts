/// <reference types='bun-types' />
import { existsSync, rmSync } from 'fs';
import pkg from './package.json';

const root = import.meta.dir;

const libDir = root + '/lib';
if (existsSync(libDir))
    rmSync(libDir, { recursive: true });

// Bundle all with Bun
Bun.build({
    format: 'esm',
    target: 'bun',
    outdir: libDir,
    minify: {
        whitespace: true,
        syntax: true
    },
    entrypoints: [
        './src/index.ts'
    ],
    external: Object.keys((pkg as any).dependencies! ?? {})
}).then(console.log);

// Build type declarations
Bun.spawn(['bun', 'x', 'tsc', '--outdir', libDir], {
    stdout: 'inherit',
    stderr: 'inherit'
});
