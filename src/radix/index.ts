import { Tree } from './tree';
import type { MatchFunction, Options, Route } from './tree/types';

export class Radix<T> {
    /**
     * The data structure to store parametric and wildcard routes
     */
    readonly tree: Tree<T> = new Tree();

    /**
     * Create a radix tree router
     */
    constructor(public readonly options: Options = {}) { }

    /**
     * Register routes
     */
    routes(routes: Route<T>[]): this {
        for (let i = 0, { length } = routes; i < length; ++i) this.put(...routes[i]);

        return this;
    }

    /**
     * Register a route
     */
    put(path: Route<T>[0], handler: Route<T>[1]): this {
        this.tree.store(path, handler);
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
    build(fallback: T | null): this {
        this.find = this.tree.compile(this.options, fallback);
        return this;
    }

    find: MatchFunction<T>;
}

export * as tree from './tree';
export * as compiler from './compiler';
