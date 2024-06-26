import type { Matcher, Options } from '../tree/types';
import getArgs from './getArgs';
import plus from './plus';

/**
 * The object for passing between recursive calls
 * @internal
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

    inlineValue(value: any): string {
        if (typeof value === 'undefined') return '';
        if (typeof value !== 'function') {
            if (typeof value !== 'symbol' && typeof value !== 'object')
                return JSON.stringify(value);
        }

        return this.options.invokeResultFunction ? this.insert(value) + getArgs(value) : this.insert(value);
    }

    /**
     * Get the statement to return the token value
     */
    inlineToken(value: string) {
        return this.options.invokeResultFunction ? value + '(c)' : value;
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
        if (length < 15) {
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
     * Return the statement to inline the router to the file
     */
    inline() {
        return this.paramsKeys.length === 0
            ? `(()=>(c)=>{${this.builder.join('')}})`
            : `((${this.paramsKeys})=>(c)=>{${this.builder.join('')}})`;
    }

    /**
     * Build a function from a function body and inject stored parameters
     */
    build(): Matcher {
        return Function(...this.paramsKeys, `return (c)=>{${this.builder.join('')}}`)(...this.paramsValues);
    }
}
