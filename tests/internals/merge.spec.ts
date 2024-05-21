import { test, expect } from 'bun:test';
import { internal } from '@bit-js/blitz';

import createContext from '@utils/createContext';
import { paths, pathsCount } from '@utils/paths';

const testPrefixes = ['/', '/base', '/nested/prefix'];

for (let i = 0, { length } = testPrefixes; i < length; ++i) {
    const actualPaths = new Array<string>(pathsCount);
    const testPrefix = testPrefixes[i];

    const firstTree = new internal.Tree();
    const secondTree = new internal.Tree();

    for (let i = 0; i < pathsCount; i += 2) {
        let j = i + 1;

        firstTree.store(paths[i], i);
        secondTree.store(paths[j], j);

        actualPaths[i] = paths[i];
        actualPaths[j] = paths[j].length === 1 ? testPrefix : (testPrefix.length === 1 ? paths[j] : testPrefix + paths[j]);
    }

    firstTree.merge(testPrefix, secondTree);

    const actualTree = new internal.Tree();
    for (let i = 0; i < pathsCount; ++i)
        actualTree.store(actualPaths[i], i);

    test(`Real tree: '${testPrefix}'`, () => {
        expect(firstTree.root!.insert(testPrefix, null).debug()).toEqual(actualTree.root!.insert(testPrefix, null).debug());
    });

    const f = firstTree.compile({}, pathsCount);
    for (let i = 0; i < pathsCount; ++i)
        test(`Merge prefix '${testPrefix}': ${actualPaths[i]}`, () => {
            expect(f(createContext(actualPaths[i]))).toBe(i);
        });
}
