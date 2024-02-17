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
export class Context<Params, State> implements BaseContext, ResponseInit {
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
     * Parsed state. States should not be directly modified
     */
    readonly state: State;

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

    /**
     * Return a response based on the context
     */
    send<T extends BodyInit>(init: T): BasicResponse<T> {
        return new Response(init, this) as any;
    };

    /**
     * Return a response based on the context
     */
    json<T>(init: T): JsonResponse<T> {
        this.headers['Content-Type'] ??= 'application/json';
        return new Response(JSON.stringify(init), this);
    }
}

export interface BasicResponse<T extends BodyInit> extends Response {
    readonly text: () => Promise<T extends string ? T : string>;
    readonly clone: () => BasicResponse<T>;
}

export interface JsonResponse<T> extends Response {
    readonly json: () => Promise<T>;
}

/**
 * A request handler
 */
export interface Handler<Params = unknown, State = unknown> {
    (c: Context<Params, State>): any;
}
