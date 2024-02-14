import { Tree } from '@internal/tree';
import paths from 'paths';

const tree = new Tree<number>();
const pathsCount = paths.length;

for (let i = 0; i < pathsCount; ++i)
    tree.store(paths[i], i);

tree.fallback = pathsCount;

// Pretty print tree
console.log(tree.debug(2));

// Print the compiled tree code
console.log(tree.compile({ substr: 'slice' }).toString());
