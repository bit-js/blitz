import type { Options, SubstrStrategy } from '../tree';
import { storePrefix } from './constants';
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
     * Substring strategy micro-optimization
     */
    readonly substrStrategy: SubstrStrategy;

    /**
     * The current ID of the store
     */
    currentID: number = 0;

    /**
     * Create the build context
     */
    constructor(options: Options) {
        this.substrStrategy = options.substr ?? 'substring';
    }

    /**
     * Store a value
     */
    put(value: any) {
        if (typeof value !== 'function' && typeof value !== 'symbol' && typeof value !== 'object')
            return JSON.stringify(value);

        const key = storePrefix + this.currentID.toString();
        ++this.currentID;

        this.paramsKeys.push(key);
        this.paramsValues.push(value);

        return key;
    }

    /**
     * Get the string statement after sliced from idx
     */
    slicePath(idx: string) {
        return idx === '0' ? 'path' : `path.${this.substrStrategy}(${idx})`;
    }

    /**
     * Get the substring statement after sliced from start to end
     */
    substringPath(start: string, end: string) {
        return `path.${this.substrStrategy}(${start},${end})`;
    }

    /**
     * Get the index of a token in the path string
     */
    searchPath(token: string, startIdx: string) {
        return `path.indexOf('${token}'${startIdx === '0' ? '' : ',' + startIdx})`;
    }

    /**
     * Create top level if statement
     */
    createTopLevelCheck(part: string, prevPathLen: string, pathLen: string) {
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

        return `if(path.${this.substrStrategy}(${prevPathLen},${pathLen})==='${part.substring(1)}')`;
    }

    /**
     * Build a function from a function body and inject stored parameters
     */
    build(body: string) {
        return Function(...this.paramsKeys, body)(...this.paramsValues);
    }
}
