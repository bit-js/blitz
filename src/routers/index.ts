import { Radix, Edge } from '../internal';
import type { GenericHandler } from '../types';
import Router from './base';

export default class Blitz extends Router<Radix<GenericHandler>> {
    /**
     * Register a handler
     */
    put(method: string, path: string, handler: GenericHandler) {
        ((this.methodRouter ??= {})[method] ??= new Radix()).put(path, handler);
    };

    /**
     * Register a handler for all method
     */
    handle(path: string, handler: GenericHandler) {
        (this.fallbackRouter ??= new Radix()).put(path, handler);
    };
}

export class EdgeRouter extends Router<Edge<GenericHandler>> {
    /**
     * Register a handler
     */
    put(method: string, path: string, handler: GenericHandler) {
        ((this.methodRouter ??= {})[method] ??= new Edge()).put(path, handler);
    };

    /**
     * Register a handler for all method
     */
    handle(path: string, handler: GenericHandler) {
        (this.fallbackRouter ??= new Edge()).put(path, handler);
    };
}
