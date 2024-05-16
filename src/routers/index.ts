import { Radix, Edge } from '../internal';
import type { GenericHandler } from '../types';
import Router from './base';

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
