import { type Context as BaseContext } from './internal/tree/types';

/**
 * Infer an URL segment parameter
 */
type Segment<T extends string> =
    T extends `:${infer Param}` ? Param
    : T extends '*' ? '$'
    : never;

/**
 * Infer URL parameter keys from path
 */
export type ParamsKey<Path extends string> = Path extends `${infer Part}/${infer Rest}`
    ? Segment<Part> | ParamsKey<Rest> : Segment<Path>;


/**
 * Infer URL parameters from path
 */
export type Params<Path extends string, Value = string> = {
    [K in ParamsKey<Path>]: Value;
}

/**
 * Request context
 */
export class Context<Params> implements BaseContext {
    path: string;

    pathStart: number;
    pathEnd: number;

    // Parsed parameters (Must be manually typed by the framework dev)
    readonly params: Params;
    readonly req: Request;

    /**
     * Parse the request
     */
    constructor(req: Request) {
        const { url } = req;

        const start = url.indexOf('/', 12);
        const end = url.indexOf('?', start + 1);

        this.pathStart = start;
        this.req = req;
        this.path = url.substring(start, this.pathEnd = end === -1 ? url.length : end);
    }
}

export interface Context<Params> {
    // ResponseInit options
    headers: Record<string, string>;
    status: number;
    statusText: string;
}

export type GenericHandler = (c: Context<any>) => any;

export interface ContextOptions extends Partial<Context<any>>, Record<string, any> { };
