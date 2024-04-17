import { Context as BaseContext, type GenericHandler } from '../types';

import type { BaseRouter } from '../internal';
import type { Matcher, Options } from '../internal/tree/types';

export default abstract class Router<BasicRouter extends BaseRouter<GenericHandler>> {
    /**
     * Map method routers
     */
    methodRouter?: Record<string, BasicRouter>;

    /**
     * Fallback router if methods do not match
     */
    fallbackRouter?: BasicRouter;

    /**
     * Fallback handler
     */
    fallback: GenericHandler = noop;

    /**
     * Create a router
     */
    constructor(readonly options: Options = {}) {
        this.options = options;
    }

    /**
     * Register a handler
     */
    abstract put(method: string, path: string, handler: GenericHandler): void;

    /**
     * Register a handler for all method
     */
    abstract handle(path: string, handler: GenericHandler): void;

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

