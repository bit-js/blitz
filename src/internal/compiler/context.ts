import type { Options } from '../tree/types';
import getArgs from './getArgs';
import plus from './plus';

/**
 * The object for passing between recursive calls
 */
export default class BuildContext {
    /**
     * Store keys
     */
    readonly paramsKeys: string[] = [];

    /**
     * Store values associated with keys
     */
    readonly paramsValues: string[] = [];

    /**
     * Micro-optimizations that compiler should do
     */
    readonly options: Required<Options>;

    /**
     * The current ID of the store
     */
    currentID: number = 0;

    /**
     * Create the build context
     */
    constructor(options: Options, readonly builder: string[] = []) {
        options.invokeResultFunction ??= false;
        this.options = options as Required<Options>;
    }

    /**
     * Put a value to the store (should only add object)
     */
    insert(value: any): string {
        const key = 'f' + this.currentID.toString();
        ++this.currentID;

        this.paramsKeys.push(key);
        this.paramsValues.push(value);

        return key;
    }

    /**
     * Get the statement to return the value
     */
    yield(value: any): string {
        if (typeof value === 'undefined') return 'return';
        if (typeof value !== 'function') {
            if (typeof value !== 'symbol' && typeof value !== 'object')
                return `return ${JSON.stringify(value)}`;
        }

        const key = this.insert(value);
        return this.options.invokeResultFunction ? `return ${key}${getArgs(value)}` : `return ${key}`;
    }

    /**
     * Get the statement to return the token value
     */
    yieldToken(value: string) {
        return this.options.invokeResultFunction ? `return ${value}(c)` : `return ${value}`;
    }

    /**
     * Get the string statement after sliced from idx
     */
    slicePath(idx: string): string {
        return idx === '0' ? 'path' : `path.substring(${idx})`;
    }

    /**
     * Get the substring statement after sliced from start to end
     */
    substringPath(start: string, end: string): string {
        return `path.substring(${start},${end})`;
    }

    /**
     * Get the index of a token in the path string
     */
    searchPath(token: string, startIdx: string): string {
        return `path.indexOf('${token}'${startIdx === '0' ? '' : ',' + startIdx})`;
    }

    /**
     * Create top level if statement
     */
    createTopLevelCheck(part: string, prevPathLen: string, pathLen: string): string {
        const { length } = part;

        // Faster than doing substring
        if (length < 16) {
            const result = new Array<string>(length);
            result[0] = '';

            // Chain char code checks
            for (let i = 1; i < length; ++i) {
                result[i] = `if(path.charCodeAt(${prevPathLen})===${part.charCodeAt(i)})`;
                prevPathLen = plus(prevPathLen, 1);
            }

            return result.join('');
        }

        return `if(path.substring(${prevPathLen},${pathLen})==='${part.substring(1)}')`;
    }

    /**
     * Build a function from a function body and inject stored parameters
     */
    build(): any {
        return Function(...this.paramsKeys, `return (c)=>{${this.builder.join('')}}`)(...this.paramsValues);
    }
}
