import { type Context as BaseContext } from './radix/tree/types';

/**
 * Infer an URL segment parameter
 */
type Segment<T extends string> =
    T extends `:${infer Param}`
    ? { [K in Param]: string }
    : T extends '*'
    ? { $: string }
    : {};

/**
 * Infer URL parameters from path
 */
export type Params<Path extends string> = Path extends `${infer Part}/${infer Rest}`
    ? Segment<Part> & Params<Rest> : Segment<Path>;

/**
 * Request context
 */
export class Context<Params> implements BaseContext, ResponseInit {
    // Parsed properties
    readonly path: string;
    readonly pathStart: number;
    readonly pathEnd: number;

    // Parsed parameters (Must be manually typed by the framework dev)
    readonly params: Params;

    /**
     * Parse the request
     */
    constructor(readonly req: Request) {
        const start = req.url.indexOf('/', 12) + 1,
            end = req.url.indexOf('?', start);

        this.pathStart = start;

        if (end === -1) {
            this.path = req.url.substring(start);
            this.pathEnd = req.url.length;
        } else {
            this.path = req.url.substring(start, end);
            this.pathEnd = end;
        }
    }

    // ResponseInit options
    readonly headers: Record<string, string> = {};
    status: number;
    statusText: string;
}

/**
 * Base request handler
 */
export interface Handler<Params = unknown> {
    (c: Context<Params>): any;
}
