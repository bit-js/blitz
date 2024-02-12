/**
 * A context object for getting the handler
 */
export interface Context {
    /**
     * Parsed pathname 
     */
    path: string;

    /**
     * The URL parameters
     */
    params: any;
}

/**
 * The object for passing between recursive calls
 */
export interface BuildContext {
    /**
     * All store map
     */
    readonly paramsMap: Record<string, any>;

    /**
     * Substring strategy micro-optimization
     */
    readonly substrStrategy: SubstrStrategy;

    /**
     * The current ID of the store
     */
    currentID: number;
}

/**
 * String substr strategy
 */
export type SubstrStrategy = 'substring' | 'slice';

/**
 * Router option
 */
export interface Options {
    substr?: SubstrStrategy;
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
