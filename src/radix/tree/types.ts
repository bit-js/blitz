/**
 * A context object for getting the handler
 */
export interface Context {
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
export interface Options {
    substrStrategy?: 'substring' | 'slice';
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
