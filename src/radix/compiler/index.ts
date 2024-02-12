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
    options: Options,
    fallback?: T
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

    const fallbackResult = typeof fallback === 'undefined' ? 'null' : insertStore(ctx, fallback);

    // Build function with all registered dependencies
    return Function(
        ...Object.keys(ctx.paramsMap),
        `return ${ctxName}=>{const{${ctxPathName}}=${ctxName},{${ctxPathEndName}}=${ctxPathName};${content.join('')}return ${fallbackResult}}`
    )(...Object.values(ctx.paramsMap));
}
