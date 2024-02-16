import { Radix } from './radix';
import type { MatchFunction, Options } from './radix/tree/types';
import { Context, type Handler } from './types';

export * as internal from './radix';

type RadixRouter = Radix<Handler>;
type Matcher = MatchFunction<any>;

export default class Blitz {
    /**
     * Methods that should be supported
     */
    static readonly methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'TRACE'] as const;

    /**
     * Map method routers
     */
    methodRouter: Record<string, RadixRouter> | null = null;

    /**
     * Fallback router if methods do not match
     */
    fallbackRouter: RadixRouter | null = null;

    /**
     * Fallback handler
     */
    fallback: Handler = noop;

    /**
     * Create a router
     */
    constructor(readonly options: Options = {}) {
        this.options = options;
    }

    /**
     * Register a handler
     */
    put(method: string, path: string, handler: Handler) {
        this.methodRouter ??= {};
        this.methodRouter[method] ??= new Radix();
        this.methodRouter[method].put(path, handler);
    }

    /**
     * Register a handler for all method
     */
    handle(path: string, handler: Handler) {
        this.fallbackRouter ??= new Radix();
        this.fallbackRouter.put(path, handler);
    }

    /**
     * Build the router
     */
    build(): (req: Request) => any {
        const { methodRouter, fallbackRouter } = this;

        // Use fallbackRouter matcher as fallback if it exist
        const fallback = fallbackRouter === null ? this.fallback : fallbackRouter.buildCaller(this.options, this.fallback);

        // Call the fallback directly if no method router exists
        if (methodRouter === null) return (req: Request) => fallback(new Context(req));

        // Compile method callers (It invokes the function directly instead of returning the matching function)
        const methodCaller: Record<string, Matcher> = {};
        for (const method in methodRouter)
            methodCaller[method] = methodRouter[method].buildCaller(this.options, fallback);

        return (req: Request) => (methodCaller[req.method] ?? fallback)(new Context(req));
    }
}

// Utils
const noop = () => null;

export * from './types';
