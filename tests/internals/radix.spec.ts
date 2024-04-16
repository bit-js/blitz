import { internal } from '@bit-js/blitz';
import paths from './paths';
import { test, expect } from 'bun:test';

const router = new internal.Radix<number>();
const pathsCount = paths.length;

for (let i = 0; i < pathsCount; ++i)
    router.put(paths[i], i);

console.log(router.tree.debug(2));

// Compile the tree
const f = router.buildMatcher({}, pathsCount);
console.log(f.toString());

for (let i = 0; i < pathsCount; ++i) {
    const path = paths[i].substring(1);

    test(`"/${path}"`, () => {
        expect(f({
            path: path.charCodeAt(path.length - 1) === 42 ? path.slice(0, -1) + '1/2/3/4/5/6/7/8/9' : path,
            params: null
        })).toBe(i);
    });
}
