import { Radix } from './radix';
import type { tree } from './radix';
import { Context, type Handler } from './types';

export * as internal from './radix';

type RadixRouter = Radix<Handler>;
type Matcher = tree.MatchFunction<Handler>;

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
     * Register a handler
     */
    put(method: string, path: string, handler: Handler) {
        if (!(method in this.methodRouter))
            this.methodRouter[method] = new Radix();

        this.methodRouter[method].put(path, handler);
    }

    /**
     * Register a handler for all method
     */
    handle(path: string, handler: Handler) {
        if (this.fallbackRouter === null)
            this.fallbackRouter = new Radix();

        this.fallbackRouter.put(path, handler);
    }

    /**
     * Return the request handler
     */
    get fetch() {
        const { methodRouter, fallbackRouter, fallback } = this;

        // Compile method matchers
        const methodMatcher: Record<string, Matcher> = {};

        if (fallbackRouter === null) {
            // Register fallback
            for (const method in methodRouter)
                methodMatcher[method] = methodRouter[method].build(fallback).find;

            return (req: Request) => {
                const ctx = new Context(req);

                const matcher = methodMatcher[req.method];
                return typeof matcher === 'undefined' ? fallback(ctx) : matcher(ctx)!(ctx);
            };
        }

        // Ignore fallback of matchers
        for (const method in methodRouter)
            methodMatcher[method] = methodRouter[method].build().find;

        // Handle with fallback matcher
        const fallbackMatcher = fallbackRouter.build(fallback).find;
        return (req: Request) => {
            const ctx = new Context(req);

            const matcher = methodMatcher[req.method];
            if (typeof matcher !== 'undefined') {
                const handler = matcher(ctx);
                if (handler !== null) return handler(ctx);
            }

            return fallbackMatcher(ctx)!(ctx);
        }
    }
}

const noop = () => null;

export * from './types';
