import { Options } from '../types';
import type { Tree } from '../tree';
import type { MatchFunction } from '../types';
import compileNode from './node';
import { ctxName, ctxPathEndName, ctxPathName } from './constants';
import insertStore from './utils/insertStore';

/**
 * Build a function body to pass into `Function` constructor later
 */
export default function compile<T>(
    tree: Tree<T>,
    options: Options<T>,
): MatchFunction<T> {
    // Global context
    const ctx = {
        currentID: 0,
        paramsMap: {},
        substrStrategy: options.substr ?? 'substring',
    };

    const content = compileNode(
        tree.root, ctx,
        '0', false, false
    );

    // Fallback handling
    const fallbackCall = typeof options.fallback === 'undefined' ? 'null' : insertStore(ctx, options.fallback);

    // Build function with all registered dependencies
    return Function(
        ...Object.keys(ctx.paramsMap),
        `return ${ctxName}=>{const{${ctxPathName}}=${ctxName},{${ctxPathEndName}}=${ctxPathName};${content.join('')}return ${fallbackCall}}`
    )(...Object.values(ctx.paramsMap));
}
