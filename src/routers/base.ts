import { Context as BaseContext, type GenericHandler } from '../types';

import type { BaseRouter } from '../internal';
import { type Context, Options } from '../internal/tree/types';

export default abstract class Router<BasicRouter extends BaseRouter<any> = BaseRouter<GenericHandler>> {
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
    fallback: any = noop;

    /**
     * Create a router
     */
    constructor(readonly options: Options = new Options()) {
        options.invokeResultFunction = true;
        this.options = options;
    }

    /**
     * Register a handler
     */
    abstract on(method: string, path: string, handler: any): void;

    /**
     * Register a handler for all method
     */
    abstract handle(path: string, handler: any): void;

    /**
     * Merge with another similar router
     */
    route(base: string, { methodRouter: otherMethodRouter, fallbackRouter: otherFallbackRouter }: this) {
        if (typeof otherMethodRouter !== 'undefined') {
            const methodRouter = this.methodRouter ??= {};

            for (const method in otherMethodRouter) {
                const router = methodRouter[method];

                if (typeof router === 'undefined') methodRouter[method] = otherMethodRouter[method];
                else router.route(base, otherMethodRouter[method]);
            }
        }

        if (typeof otherFallbackRouter !== 'undefined') {
            const { fallbackRouter } = this;

            if (typeof fallbackRouter === 'undefined') this.fallbackRouter = otherFallbackRouter;
            else fallbackRouter.route(base, otherFallbackRouter);
        }
    }

    /**
     * Build the router
     */
    build(Construct: new (req: Request) => Context = BaseContext): (req: Request) => any {
        const { methodRouter, options } = this;
        const fallback = this.fallbackRouter?.buildCaller(options, this.fallback) ?? this.fallback;

        // Use fallbackRouter matcher as fallback if it exist
        // Call the fallback directly if no method router exists
        if (methodRouter === undefined)
            return (req) => fallback(new Construct(req));

        // Compile method callers (It invokes the function directly instead of returning the matching function)
        const methodCaller = {};
        for (const method in methodRouter)
            methodCaller[method] = methodRouter[method].buildCaller(options, fallback);

        return (req) => (methodCaller[req.method] ?? fallback)(new Construct(req));
    }
}

// Utils
const noop = () => null;

