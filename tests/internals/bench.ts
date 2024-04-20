import { internal } from '@bit-js/blitz';
import { run, bench, group } from 'mitata';
import paths from './paths';
import createContext from './createContext';

const pathsCount = paths.length;
const ctxs = paths.map(createContext);

const routers = {
    radix: new internal.Radix(),
    edge: new internal.Edge()
};

// Main stuff
for (let i = 0; i < pathsCount; ++i)
    for (const name in routers)
        routers[name].put(paths[i], i);

const fns: Record<string, any> = {};
for (const name in routers)
    console.log(name, (fns[name] = routers[name].buildMatcher({}, pathsCount)).toString());

for (let i = 0; i < pathsCount; ++i) {
    const ctx = ctxs[i];

    group(paths[i], () => {
        for (const name in fns) {
            const match = fns[name];
            bench(name, () => match(ctx));
        }
    });
}

// Exec the bench
run();
