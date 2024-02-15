import type { tree } from './radix';

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
export class Context<Params, State> implements tree.Context, ResponseInit {
    /**
     * Parsed pathname
     */
    readonly path: string;

    /**
     * Start path index
     */
    readonly pathStart: number;

    /**
     * End path index
     */
    readonly pathEnd: number;

    /**
     * Request params
     */
    readonly params: Params;

    /**
     * Parsed state
     */
    state: State;

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

    /**
     * Headers
     */
    readonly headers: Record<string, string> = {};

    /**
     * Status code
     */
    status: number;

    /**
     * Status text
     */
    statusText: string;
}

/**
 * A request handler
 */
export interface Handler<Params = unknown, State = unknown> {
    (c: Context<Params, State>): any;
}
