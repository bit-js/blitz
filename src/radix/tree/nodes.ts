import type BuildContext from '../compiler/context';
import { ctxParamsName, currentParamIdx, prevParamIdx } from '../compiler/constants';
import plus from '../compiler/plus';

/**
 * A parametric node
 */
export class ParamNode {
    paramName: string;
    store: any = null;
    inert: Node | null = null;

    constructor(name: string) {
        if (name === '$') throw new Error('Parameter name should not be "$" to avoid collision with wildcard parameter');
        this.paramName = name;
    }
}

/**
 * A static node
 */
export class Node {
    part: string;
    store: any = null;
    inert: Map<number, Node> | null = null;
    params: ParamNode | null = null;
    wildcardStore: any = null;

    /**
     * Create a node
     */
    constructor(part: string) {
        this.part = part;
    }

    /**
     * Reset a node. Use this to move down a node then add children
     */
    reset(part: string): void {
        this.part = part;

        // Next step should be adding children
        this.inert = new Map();
        this.store = this.params = this.wildcardStore = null;
    }

    /**
     * Clone the current node with new part
     */
    clone(part: string): Node {
        const node: Node = new Node(part);

        node.store = this.store;
        node.inert = this.inert;
        node.params = this.params;
        node.wildcardStore = this.wildcardStore;

        return node;
    }

    /**
     * Register a node as children
     */
    adopt(child: Node): void {
        this.inert!.set(child.part.charCodeAt(0), child);
    }

    /**
     * Set parametric node
     */
    param(paramName: string): ParamNode {
        if (this.params === null)
            this.params = new ParamNode(paramName);
        else if (this.params.paramName !== paramName)
            throw new Error(
                `Cannot create route with parameter "${paramName}" \
                because a route already exists with a different parameter name \
                ("${this.params.paramName}") in the same location`
            );

        return this.params;
    }

    /**
     * Compile a node into string parts to merge later with tree.compile
     */
    compile(
        ctx: BuildContext,
        // Track previous path length (can be static or a variable name)
        prevPathLen: string,
        // Whether parameters exist
        isChildParam: boolean,
        // Whether the index tracker for parameters exists (not creating many variables)
        isNestedChildParam: boolean
    ): void {
        const { builder } = ctx;
        const isNotRoot = this.part.length !== 1;

        // Get current path length from root node to this node
        const pathLen = plus(
            prevPathLen,
            this.part.length - 1
        );

        // No condition check for root (no scope should be created)
        if (isNotRoot) {
            builder.push(ctx.createTopLevelCheck(this.part, prevPathLen, pathLen));
            builder.push('{');
        }

        if (this.store !== null)
            // Check whether the current length is equal to current path length
            builder.push(`if(path.length===${pathLen})${ctx.yield(this.store)};`);

        if (this.inert !== null) {
            const pairs = this.inert.entries(), nextPathLen = plus(pathLen, 1);
            let currentPair = pairs.next();

            // Create an if statement for only one item
            if (this.inert.size === 1) {
                builder.push(`if(path.charCodeAt(${pathLen})===${currentPair.value[0]}){`);
                currentPair.value[1].compile(
                    ctx, nextPathLen, isChildParam, isNestedChildParam
                );
                builder.push('}');
            }

            // Create a switch for multiple items
            else {
                builder.push(`switch(path.charCodeAt(${pathLen})){`);

                do {
                    // Create a case statement for each char code
                    builder.push(`case ${currentPair.value[0]}:`);
                    currentPair.value[1].compile(
                        ctx, nextPathLen, isChildParam, isNestedChildParam
                    );
                    builder.push('break;');

                    currentPair = pairs.next();
                } while (!currentPair.done);

                builder.push('}');
            }
        }

        if (this.params !== null) {
            const { params } = this;

            // Reuse the variable if declared before
            const prevIndex = isChildParam ? prevParamIdx : pathLen;

            // Declare a variable to save previous param index 
            // if current parameter is the second one
            if (isChildParam) {
                // Reuse the variable for third parameter and so on
                if (!isNestedChildParam) builder.push('let ');
                builder.push(`${prevParamIdx}=${pathLen};`);
            }

            const nextSlashIndex = ctx.searchPath('/', prevIndex),
                hasInert = params.inert !== null,
                hasStore = params.store !== null,
                { paramName } = params;

            // Declare the current param index variable if inert is found
            if (hasInert) {
                if (!isChildParam) builder.push('let ');
                builder.push(`${currentParamIdx}=${nextSlashIndex};`);
            }

            // Check slash index and get the parameter value if store is found
            if (hasStore) {
                builder.push(`if(${hasInert ? currentParamIdx : nextSlashIndex}===-1){`);

                // Set param
                const value = ctx.slicePath(prevIndex);

                builder.push(ctxParamsName);
                builder.push(isChildParam
                    ? `.${paramName}=${value};`
                    : `={${paramName}:${value}};`);
                builder.push(ctx.yield(this.params.store));

                // End the if statement
                builder.push('}');
            }

            if (hasInert) {
                const value = ctx.substringPath(prevIndex, currentParamIdx);

                // Additional check if no store is provided (if store exists the previous part should match and return the store)
                if (!hasStore) builder.push(`if(${currentParamIdx}!==-1){`);

                // Assign param
                builder.push(ctxParamsName);
                builder.push(isChildParam
                    ? `.${paramName}=${value};`
                    : `={${paramName}:${value}};`
                );

                // Handle inert
                params.inert!.compile(
                    ctx, plus(currentParamIdx, 1), true,
                    // If this is the first parameter inert this will be false
                    isChildParam
                );

                if (!hasStore) builder.push('}');
            }
        }

        if (this.wildcardStore !== null) {
            const value = ctx.slicePath(pathLen);

            // Assign wildcard parameter
            builder.push(ctxParamsName);
            builder.push(isChildParam ? `.$=${value};` : `={$:${value}};`)
            builder.push(ctx.yield(this.wildcardStore));

            builder.push(';');
        }

        // Root does not include a check
        if (isNotRoot) builder.push('}');
    };
}
