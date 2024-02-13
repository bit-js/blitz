import splitPath, { type PathParts } from '@internal/tree/splitPath';

import { test, expect } from 'bun:test';
import { run, bench, group } from 'mitata';

import paths from 'paths';

// Regex version of split path (Slow but correct)
const staticRegex = /:.+?(?=\/|$)/;
const paramsRegex = /:.+?(?=\/|$)/g;

function splitPathRegex(path: string): PathParts {
    const inertParts = path.split(staticRegex);
    const paramParts = path.match(paramsRegex) ?? [];
    if (inertParts[inertParts.length - 1].length === 0) inertParts.pop();

    return [inertParts, paramParts];
}

// Validate results of split path
test('Compare paths', () => {
    for (let path of paths) {
        if (path.endsWith('*')) path = path.slice(0, -1);
        expect(splitPath(path)).toEqual(splitPathRegex(path));
    }
});


// Benchmark
for (let i = 0; i < 30; ++i) bench('', () => { });

group('Split path', () => {
    bench('Regex', () => paths.map(splitPathRegex));
    bench('Non-regex', () => paths.map(splitPath));
});
run();
