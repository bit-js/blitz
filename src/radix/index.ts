import compile from './compiler';
import { Tree } from './tree';
import type { MatchFunction, Options, Route } from './types';

export class Radix<T> {
    /**
     * The data structure to store parametric and wildcard routes
     */
    readonly tree: Tree<T> = new Tree();

    /**
     * Store static routes
     */
    readonly map: Record<string, T> = {};

    /**
     * The fallback result
     */
    fallback?: T;

    /**
     * Create a radix tree router
     */
    constructor(public readonly options: Options = {}) { }

    /**
     * Register routes
     */
    routes(routes: Route<T>[]): this {
        for (let i = 0, { length } = routes; i < length; ++i) this.put(routes[i]);

        return this;
    }

    /**
     * Register a route
     */
    put(route: Route<T>): this {
        const path = route[0];

        // If path includes parameters or wildcard add to the tree
        if (path.includes(':') || path.charCodeAt(path.length - 1) === 42)
            this.tree.store(route[0], route[1]);
        // Static path matches faster with a map
        else
            this.map[path] = route[1];
        return this;
    }

    /**
     * Create and register routes
     */
    static create<T>(routes: Route<T>[]): Radix<T> {
        return new this<T>().routes(routes);
    }

    /**
     * Build a find function
     */
    build(): this {
        const searchTree = compile(
            this.tree, this.options,
            this.fallback
        );
        const { map } = this;

        this.find = c => map[c.path] ?? searchTree(c);
        return this;
    }
}

export interface Radix<T> {
    find: MatchFunction<T>;
};

export * from './tree';
export * from './types';
export { default as compile } from './compiler';
