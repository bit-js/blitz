import { internal } from '@bit-js/blitz';
import { test, expect } from 'bun:test';

import { paths, pathsCount } from '@utils/paths';
import createContext from '@utils/createContext';

function run(name: string, router: internal.BaseRouter<number>) {
    for (let i = 0; i < pathsCount; ++i)
        router.put(paths[i], i);

    // Compile the tree
    const f = router.buildMatcher({}, pathsCount);
    console.log(f.toString());

    for (let i = 0; i < pathsCount; ++i)
        test(`${name}: "${paths[i]}"`, () => {
            expect(f(createContext(paths[i]))).toBe(i);
        });
}

run('Radix', new internal.Radix());
run('Edge', new internal.Edge());
