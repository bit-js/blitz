import { Tree } from './tree';
import type { MatchFunction, Options, Route } from './tree/types';

type ReturnOf<T> = T extends (...args: any) => infer R ? R : any;

export abstract class BaseRouter<T> {
    /**
     * The data structure to store parametric and wildcard routes
     */
    readonly tree: Tree = new Tree();

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
     * Merge with another similar router
     */
    merge(base: string, router: this) {
        this.tree.merge(base, router.tree);
    }

    /**
     * Build a function to match and find the value
     */
    abstract buildMatcher(options: Options, fallback: T | null): MatchFunction<T>;

    /**
     * Build a function to match and call the value
     */
    abstract buildCaller(options: Options, fallback: T | null): MatchFunction<ReturnOf<T>>
}

export class Radix<T> extends BaseRouter<T> {
    buildMatcher(options: Options, fallback: T | null): MatchFunction<T> {
        options.invokeResultFunction = false;
        return this.tree.compile(options, fallback);
    }

    buildCaller(options: Options, fallback: T | null): MatchFunction<ReturnOf<T>> {
        options.invokeResultFunction = true;
        return this.tree.compile(options, fallback) as any;
    }
}

export class Edge<T> extends BaseRouter<T> {
    buildMatcher(options: Options, fallback: T | null): MatchFunction<T> {
        options.invokeResultFunction = false;
        return this.tree.compileMatcher(options, fallback);
    }

    buildCaller(options: Options, fallback: T | null): MatchFunction<ReturnOf<T>> {
        options.invokeResultFunction = true;
        return this.tree.compileMatcher(options, fallback) as any;
    }
}

export { Tree };
export { Context } from './tree/types'; 
