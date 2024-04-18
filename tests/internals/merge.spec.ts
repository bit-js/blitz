import { test, expect } from 'bun:test';
import { internal } from '@bit-js/blitz';
import paths from './paths';
import createContext from './createContext';

const pathsCount = paths.length;
const testPrefixes = ['/', '/base', '/nested/prefix', '/a/random/parameter/here/:param'];

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
        actualPaths[j] = (paths[j].length === 1 ? testPrefix : testPrefix + paths[j]).replace(/\/\//, '/');
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
            expect(f(createContext(actualPaths[i].substring(1)))).toBe(i);
        });
}
