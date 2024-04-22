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
export class Context<Params> implements BaseContext, ResponseInit {
    path: string;

    pathStart: number;
    pathEnd: number;

    // Parsed parameters (Must be manually typed by the framework dev)
    readonly params: Params;

    // ResponseInit options
    headers: Record<string, string>;
    status: number;
    statusText: string;

    /**
     * Parse the request
     */
    constructor(readonly req: Request) {
        const start = req.url.indexOf('/', 12),
            end = req.url.indexOf('?', start + 1);

        this.pathStart = start;

        if (end === -1) {
            this.path = req.url.substring(start);
            this.pathEnd = req.url.length;
        } else {
            this.path = req.url.substring(start, end);
            this.pathEnd = end;
        }
    }
}

export type GenericHandler = (c: Context<any>) => any;

export interface ContextOptions extends Partial<Context<any>>, Record<string, any> { };

export function extendContext(C: any, defaultOpts?: ContextOptions): any {
    if (typeof defaultOpts === 'undefined') return C;

    const parts: string[] = [];
    for (const prop in defaultOpts)
        parts.push(`${prop}=${JSON.stringify(defaultOpts[prop])}`);

    return Function(`return (C)=>{return class A extends C{${parts.join()}}}`)()(C);
}
