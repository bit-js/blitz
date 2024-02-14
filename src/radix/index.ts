import { Tree } from './tree';
import type { MatchFunction, Options, Route } from './tree/types';

export class Radix<T> {
    /**
     * The data structure to store parametric and wildcard routes
     */
    readonly tree: Tree<T> = new Tree();


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
        this.tree.store(route[0], route[1]);
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
        this.tree.fallback = this.fallback;
        this.find = this.tree.compile(this.options);
        return this;
    }
}

export interface Radix<T> {
    find: MatchFunction<T>;
};

export * as tree from './tree';
