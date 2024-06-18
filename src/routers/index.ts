import { Radix, Edge } from '../internal';
import type { GenericHandler } from '../types';
import Router, { noop } from './base';

export interface InlineOptions {
    /**
     * The path to file that `export default` the router
     */
    routerImportSource: string;

    /**
     * The path to file that export `Context` as a named export
     */
    contextImportSource: string;
}

export default class Blitz<Handler = GenericHandler> extends Router<Radix<Handler>> {
    /**
     * Register a handler
     */
    on(method: string, path: string, handler: Handler) {
        ((this.methodRouter ??= {})[method] ??= new Radix()).on(path, handler);
    }

    /**
     * Register a handler for all method
     */
    handle(path: string, handler: Handler) {
        (this.fallbackRouter ??= new Radix()).on(path, handler);
    }

    /**
     * Inline the router into a file
     */
    inline({ routerImportSource, contextImportSource }: InlineOptions) {
        const { methodRouter, fallbackRouter, options } = this;

        const literal = `/**@ts-nocheck*/import r from ${JSON.stringify(routerImportSource)};import {Context} from ${JSON.stringify(contextImportSource)};${fallbackRouter === undefined
            ? 'const {fallback}=r'
            : `const fallback=${fallbackRouter.inline(options, noop)}(...r.fallbackRouter.getDependencies(r.fallback))`
            };`;
        if (methodRouter === undefined) return literal + 'export default (c)=>fallback(new Context(c))';

        const keys = Object.keys(methodRouter);

        return `${literal}const {methodRouter}=r;const o={${keys
            .map((key) => `${key}:${methodRouter[key].inline(options, noop)}(...methodRouter.${key}.getDependencies(fallback))`)
            .join(',')}};export default (c)=>(o[c.method]??fallback)(new Context(c))`;
    }
}

export class EdgeRouter<Handler = GenericHandler> extends Router<Edge<Handler>> {
    /**
     * Register a handler
     */
    on(method: string, path: string, handler: Handler) {
        ((this.methodRouter ??= {})[method] ??= new Edge()).on(path, handler);
    }

    /**
     * Register a handler for all method
     */
    handle(path: string, handler: Handler) {
        (this.fallbackRouter ??= new Edge()).on(path, handler);
    }
}
