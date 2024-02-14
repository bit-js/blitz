import { Radix } from './radix';
import type { tree } from './radix';
import { Context, type Handler } from './types';

export * as internal from './radix';

type RadixRouter = Radix<Handler>;
type Matcher = tree.MatchFunction<Handler>;

export class Blitz {
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
        const { methodRouter, fallbackRouter, fallback } = this, noFallbackRoute = fallbackRouter === null;

        // Skip null check at the end because fallback default is set to noop
        if (noFallbackRoute)
            for (const method in methodRouter)
                methodRouter[method].fallback = fallback;
        else
            this.fallbackRouter!.fallback = fallback;

        // Compile method matchers
        const methodMatcher: Record<string, Matcher> = {};
        for (const method in methodRouter)
            methodMatcher[method] = methodRouter[method].build().find;

        // Very simple handling if fallback router does not exists
        if (noFallbackRoute)
            return (req: Request) => {
                const matcher = methodMatcher[req.method];
                if (typeof matcher === 'undefined') return null;

                const ctx = new Context(req);

                // Skip null check here 
                return matcher(ctx)!(ctx);
            };

        const fallbackMatcher = fallbackRouter.build().find;
        return (req: Request) => {
            const ctx = new Context(req), matcher = methodMatcher[req.method];

            if (typeof matcher !== 'undefined') {
                const handler = matcher(ctx);
                if (handler !== null) return handler(ctx);
            }

            // Skip null check here
            return fallbackMatcher(ctx)!(ctx);
        }
    }
}

const noop = () => null;
