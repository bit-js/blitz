import { internal } from '@bit-js/blitz';
import { run, bench, group } from 'mitata';

import { paths, pathsCount } from '@utils/paths';
import createContext from '@utils/createContext';

const ctxs = paths.map(createContext);

const routers = {
    radix: new internal.Radix(),
    edge: new internal.Edge()
};

// Register routes
for (let i = 0; i < pathsCount; ++i)
    for (const name in routers)
        routers[name].put(paths[i], i);

// Build all routers into matchers
const fns: Record<string, any> = {};
for (const name in routers) {
    const match = fns[name] = routers[name].buildMatcher({}, pathsCount);

    for (let i = 0; i < pathsCount; ++i) {
        match(ctxs[i]);
        match(ctxs[i]);
        match(ctxs[i]);
    }
}

// Load tests
for (let i = 0; i < 15; ++i) bench('noop', () => { });

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
