import { Radix } from './radix';
import type { MatchFunction, Options } from './radix/tree/types';
import { Context as BaseContext } from './types';

export * as internal from './radix';

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
     * Build the fallback handler (include fallbackRouter)
     */
    buildFallback() {
        return typeof this.fallbackRouter === 'undefined'
            ? this.fallback
            : this.fallbackRouter.buildCaller(this.options, this.fallback);
    }

    /**
     * Build the router
     */
    build(Construct: typeof BaseContext = BaseContext): (req: Request) => any {
        const { methodRouter } = this, fallback = this.buildFallback();

        // Use fallbackRouter matcher as fallback if it exist
        // Call the fallback directly if no method router exists
        if (typeof methodRouter === 'undefined')
            return (req: Request) => fallback(new Construct(req));

        // Compile method callers (It invokes the function directly instead of returning the matching function)
        const methodCaller: Record<string, Matcher> = {};
        for (const method in methodRouter)
            methodCaller[method] = methodRouter[method].buildCaller(this.options, fallback);

        return (req: Request) => (methodCaller[req.method] ?? fallback)(new Construct(req));
    }
}

// Utils
const noop = () => null;

export * from './types';

