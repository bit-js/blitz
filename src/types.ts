/**
 * Infer an URL segment parameter
 */
export type Segment<T extends string> =
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
export interface Context<Params = any> {
    path: string;
    startPath: number;
    endPath: number;
    params: Params;
}

/**
 * A request handler
 */
export interface Handler {
    (c: Context): any;
}
