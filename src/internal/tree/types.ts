/**
 * A context object for getting the handler
 */
export class Context {
    /**
     * Parsed pathname (Should not start with '/') 
     */
    path: string;

    /**
     * The URL parameters
     */
    params: any;
}

/**
 * Router option
 */
export class Options {
    invokeResultFunction?: boolean;
}

/**
 * Represent a handler
 */
export type Route<T> = [path: string, store: T];

/**
 * A match function
 */
export interface MatchFunction<T> {
    (c: Context): T | null;
}

export type Matcher = MatchFunction<any>;
