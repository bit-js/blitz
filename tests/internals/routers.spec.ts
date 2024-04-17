import { internal } from '@bit-js/blitz';
import paths from './paths';
import { test, expect } from 'bun:test';
import createContext from './createContext';

function run(name: string, router: internal.BaseRouter<number>) {
    const pathsCount = paths.length;

    for (let i = 0; i < pathsCount; ++i)
        router.put(paths[i], i);

    // Compile the tree
    const f = router.buildMatcher({}, pathsCount);

    for (let i = 0; i < pathsCount; ++i) {
        const path = paths[i].substring(1);

        test(`${name}: "/${path}"`, () => {
            expect(f(createContext(path))).toBe(i);
        });
    }
}

run('Radix', new internal.Radix());
run('Edge', new internal.Edge());
