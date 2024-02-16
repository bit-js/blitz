import { Tree } from './tree';
import type { MatchFunction, Options, Route } from './tree/types';

export class Radix<T> {
    /**
     * The data structure to store parametric and wildcard routes
     */
    readonly tree: Tree = new Tree();

    /**
     * Create a radix tree router
     */
    constructor() { }

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
     * Build a function to match and find the value
     */
    buildMatcher(options: Options, fallback: T | null): MatchFunction<T> {
        options.invokeResultFunction = false;
        return this.tree.compile(options, fallback);
    }

    /**
     * Build a function to match and call the value
     */
    buildCaller(options: Options, fallback: T | null): MatchFunction<ReturnOf<T>> {
        options.invokeResultFunction = true;
        return this.tree.compile(options, fallback) as any;
    }
}

type ReturnOf<T> = T extends (...args: any) => infer R ? R : any;
