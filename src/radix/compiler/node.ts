import type { Node } from '../tree';
import type { BuildContext } from '../types';

import plus from './utils/plus';
import storeCheck from './utils/storeCheck';
import createTopLevelCheck from './utils/createTopLevelCheck';

import {
    ctxParamsName, ctxPathEndName, ctxPathName,
    currentParamIndexName, prevParamIndexName
} from './constants';

export default function compileNode(
    node: Node<any>,
    ctx: BuildContext,
    // Track previous path (can be static or a variable name)
    prevPathLen: string,
    // Whether parameters exist
    isChildParam: boolean,
    // Whether the index tracker for parameters exists (not creating many variables)
    isNestedChildParam: boolean
): string[] {
    // Get current pathname
    const
        builder: string[] = [],
        isNotRoot = node.part.length !== 1,
        pathLen = plus(
            prevPathLen,
            node.part.length - 1
        );

    // No condition check for root
    if (isNotRoot) {
        builder.push(createTopLevelCheck(ctx, node, prevPathLen, pathLen));
        builder.push('{');
    }

    // Normal handler
    if (node.store !== null)
        builder.push(storeCheck(
            `${ctxPathEndName}===${pathLen}`,
            node.store, ctx, null
        ));

    if (node.inert !== null) {
        const keys = node.inert.keys(), newPathLen = plus(pathLen, 1);
        let it = keys.next();

        // Create an if statement for only one item
        if (node.inert.size === 1) {
            builder.push(`if(${ctxPathName}.charCodeAt(${pathLen})===${it.value})`);

            builder.push(...compileNode(
                node.inert.get(it.value)!, ctx,
                newPathLen, isChildParam, isNestedChildParam
            ));
        }

        // Create a switch for multiple items
        else {
            builder.push(`switch(${ctxPathName}.charCodeAt(${pathLen})){`);

            do {
                // Create a case statement for each char code
                builder.push(`case ${it.value}:`);
                builder.push(...compileNode(
                    node.inert.get(it.value)!, ctx,
                    newPathLen, isChildParam, isNestedChildParam
                ));
                builder.push('break;');

                it = keys.next();
            } while (!it.done);

            builder.push('}');
        }
    }

    if (node.params !== null) {
        const { params } = node;

        // Reuse the variable if declared before
        const prevIndex = isChildParam ? prevParamIndexName : pathLen;

        // Declare a variable to save previous param index 
        // if current parameter is the second one
        if (isChildParam) {
            // Reuse the variable for third parameter and so on
            if (!isNestedChildParam)
                builder.push('let ');

            builder.push(`${prevParamIndexName}=${pathLen};`);
        }

        const nextSlashIndex = `${ctxPathName}.indexOf('/'${prevIndex === '0' ? '' : ',' + prevIndex})`,
            hasInert = params.inert !== null,
            hasStore = params.store !== null,
            key = params.paramName;

        // Declare the current param index variable if inert is found
        if (hasInert) {
            if (!isChildParam)
                builder.push('let ');

            builder.push(`${currentParamIndexName}=${nextSlashIndex};`);
        }

        // Check slash index and get the parameter value if store is found
        if (hasStore) {
            const value = `${ctxPathName}.${ctx.substrStrategy}(${prevIndex})`;

            builder.push(storeCheck(
                `${hasInert ? currentParamIndexName : nextSlashIndex}===-1`,
                node.params.store!, ctx,
                // Set params before return
                `${ctxParamsName}${isChildParam
                    ? `.${key}=${value}`
                    : `={${key}:${value}}`
                };`
            ));
        }

        if (hasInert) {
            const value = `${ctxPathName}.${ctx.substrStrategy}(${prevIndex},${currentParamIndexName})`;

            // Additional check if no store is provided (if store exists the previous part should match the path first)
            if (!hasStore)
                builder.push(`if(${currentParamIndexName}!==-1){`);

            // Assign param
            builder.push(ctxParamsName);
            builder.push(isChildParam
                ? `.${key}=${value};`
                : `={${key}:${value}};`
            );

            // Handle inert
            builder.push(...compileNode(
                params.inert!, ctx,
                plus(currentParamIndexName, 1), true,
                // If this is the first parameter inert this will be false
                isChildParam
            ));

            if (!hasStore)
                builder.push('}');
        }
    }

    if (node.wildcardStore !== null) {
        const value = `${ctxPathName}.${ctx.substrStrategy}(${pathLen})`;

        // Assign wildcard parameter
        builder.push(ctxParamsName);
        builder.push(isChildParam ? `.$=${value};` : `={$:${value}};`)
        builder.push(storeCheck(null, node.wildcardStore, ctx, null));
    }

    // Root does not include a check
    if (isNotRoot) builder.push('}');

    return builder;
};
