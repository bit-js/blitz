import type { Options } from '../tree/types';
import { storePrefix, ctxName } from './constants';
import getArgs, { defaultArgs } from './getArgs';
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
        const key = storePrefix + this.currentID.toString();
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
     * Return default call arguments if invokeResultFunction is true
     */
    defaultArgs() {
        return this.options.invokeResultFunction ? defaultArgs : '';
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
        // Faster than doing substring
        if (part.length < 15) {
            const result: string[] = [];

            // Chain char code checks
            for (let i = 1, { length } = part; i < length; ++i) {
                result.push(`if(path.charCodeAt(${prevPathLen})===${part.charCodeAt(i)})`);
                prevPathLen = plus(prevPathLen, 1);
            }

            return result.join('');
        }

        return `if(path.substring(${prevPathLen},${pathLen})==='${part.substring(1)}')`;
    }

    /**
     * Add a part to the string builder
     */
    concat(part: string) {
        this.builder.push(part);
    }

    /**
     * Release the result string of the string builder and reset the builder
     */
    flush() {
        const res = this.builder.join('');
        this.builder.length = 0;
        return res;
    }

    /**
     * Build a function from a function body and inject stored parameters
     */
    build(): any {
        return Function(...this.paramsKeys, `return (${ctxName})=>{${this.flush()}}`)(...this.paramsValues);
    }
}
