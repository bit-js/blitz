import { Radix } from './internal';
import type { MatchFunction, Options } from './internal/tree/types';
import { Context as BaseContext } from './types';

export * as internal from './internal';

type Handler = (c: BaseContext<any>) => any;
type RadixRouter = Radix<Handler>;
type Matcher = MatchFunction<any>;

export default class Blitz {
    /**
     * Map method routers
     */
    methodRouter?: Record<string, RadixRouter>;

    /**
     * Fallback router if methods do not match
     */
    fallbackRouter?: RadixRouter;

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
        ((this.methodRouter ??= {})[method] ??= new Radix()).put(path, handler);
    }

    /**
     * Register a handler for all method
     */
    handle(path: string, handler: Handler) {
        (this.fallbackRouter ??= new Radix()).put(path, handler);
    }

    /**
     * Build the router
     */
    build(Construct: typeof BaseContext = BaseContext): (req: Request) => any {
        const { methodRouter, fallbackRouter } = this;
        const fallback = typeof fallbackRouter === 'undefined'
            ? this.fallback
            : fallbackRouter.buildCaller(this.options, this.fallback);

        // Use fallbackRouter matcher as fallback if it exist
        // Call the fallback directly if no method router exists
        if (typeof methodRouter === 'undefined')
            return (req) => fallback(new Construct(req));

        // Compile method callers (It invokes the function directly instead of returning the matching function)
        const methodCaller: Record<string, Matcher> = {};
        for (const method in methodRouter)
            methodCaller[method] = methodRouter[method].buildCaller(this.options, fallback);

        return (req) => (methodCaller[req.method] ?? fallback)(new Construct(req));
    }
}

// Utils
const noop = () => null;

export * from './types';
export { default as FileSystemRouter } from './fsrouter';

