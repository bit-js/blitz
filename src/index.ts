import { Radix } from './radix';
import type { tree } from './radix';
import { Context, type Handler } from './types';

export * as internal from './radix';

type RadixRouter = Radix<Handler>;
type Matcher = tree.MatchFunction<any>;

const defaultOptions: tree.Options = { invokeResultFunction: true };

export default class Blitz {
    /**
     * Methods that should be supported
     */
    static readonly methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'] as const;

    /**
     * Map method routers
     */
    readonly methodRouter: Record<string, RadixRouter> = {};

    /**
     * Fallback router if methods do not match
     */
    fallbackRouter: RadixRouter | null = null;

    /**
     * Fallback handler
     */
    fallback: Handler = noop;

    /**
     * Radix router options
     */
    readonly options: tree.Options;

    /**
     * Create a router
     */
    constructor(options?: tree.Options) {
        if (typeof options === 'undefined')
            this.options = defaultOptions;
        else {
            options.invokeResultFunction = true;
            this.options = options;
        }
    }

    /**
     * Register a handler
     */
    put(method: string, path: string, handler: Handler) {
        if (!(method in this.methodRouter))
            this.methodRouter[method] = new Radix(this.options);

        this.methodRouter[method].put(path, handler);
    }

    /**
     * Register a handler for all method
     */
    handle(path: string, handler: Handler) {
        if (this.fallbackRouter === null)
            this.fallbackRouter = new Radix(this.options);

        this.fallbackRouter.put(path, handler);
    }

    /**
     * Return the request handler
     */
    get fetch(): (req: Request) => any {
        const { methodRouter, fallbackRouter, fallback } = this;

        // Compile method matchers
        const methodMatcher: Record<string, Matcher> = {};

        // No all method handler handling
        if (fallbackRouter === null) {
            // Register fallback to method matchers
            for (const method in methodRouter)
                methodMatcher[method] = methodRouter[method].build(fallback).find;

            return (req: Request) => (methodMatcher[req.method] ?? fallback)(new Context(req));
        }

        // Ignore fallback of matchers
        for (const method in methodRouter)
            methodMatcher[method] = methodRouter[method].build(null).find;

        // Handle with fallback matcher
        const fallbackMatcher = fallbackRouter.build(fallback).find;
        return (req: Request) => {
            const ctx = new Context(req);

            const matcher = methodMatcher[req.method];
            if (typeof matcher !== 'undefined') {
                const handler = matcher(ctx);
                if (handler !== null) return handler(ctx);
            }

            return fallbackMatcher(ctx);
        }
    }
}

// Utils
const noop = () => null;

export * from './types';
