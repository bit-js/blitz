import { Radix, Edge } from '../internal';
import type BuildContext from '../internal/compiler/context';
import type { GenericHandler } from '../types';
import Router from './base';

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

    fallbackRouterContext?: BuildContext;
    methodRouterContext?: Record<string, BuildContext>;

    /**
     * Setup all required states for inlining
     */
    setupInline() {
        const { methodRouter, fallbackRouter, options, fallback } = this;
        this.fallbackRouterContext = fallbackRouter?.inspect(options, fallback);

        if (methodRouter !== undefined) {
            const ctx = this.methodRouterContext = {};
            for (const key in methodRouter) ctx[key] = methodRouter[key].inspect(options, fallback);
        }

        return this;
    }

    /**
     * Inline the router into a file
     */
    inline({ routerImportSource, contextImportSource }: InlineOptions) {
        const { methodRouter, fallbackRouter } = this;

        const literal = `/**@ts-nocheck*/import r from ${JSON.stringify(routerImportSource)};import {Context} from ${JSON.stringify(contextImportSource)};${fallbackRouter === undefined ? 'const {fallback}=r' : `const fallback=${this.fallbackRouterContext?.inline()}(r.fallbackRouterContext)`};`;
        if (methodRouter === undefined) return literal + 'export default (c)=>fallback(new Context(c))';

        const { methodRouterContext } = this;
        const keys = Object.keys(methodRouter);

        return `${literal}const {methodRouterContext:{${keys}}}=r;const o={${keys
            .map((key) => `${key}:${methodRouterContext![key].inline()}(${key})`)
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
