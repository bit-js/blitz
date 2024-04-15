import type BuildContext from '../compiler/context';
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

export class InertStore {
    store: Record<string, Node> = {};
    map: Map<number, Node> = new Map();

    size: number = 0;
    lastChild: Node;

    put(item: Node) {
        this.lastChild = item;

        this.store[item.key] = item;
        this.map.set(item.key.charCodeAt(0), item);

        ++this.size;
    }
}

/**
 * A static node
 */
export class Node {
    part: string;
    key: string;

    store: any = null;
    inert: InertStore | null = null;
    params: ParamNode | null = null;
    wildcardStore: any = null;

    /**
     * Set part and the corresponding inert key for that part before compilation
     */
    setPart(part: string) {
        this.part = part;
        this.key = part.charCodeAt(0).toString();
    }

    /**
     * Create a node
     */
    constructor(part: string) {
        this.setPart(part);
    }

    /**
     * Reset a node. Use this to move down a node then add children
     */
    reset(part: string, firstChild: Node): void {
        this.setPart(part);

        // Next step should be adding children
        this.inert = new InertStore();
        this.inert.put(firstChild);
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
        const { part } = this;

        // Get current path length from root node to this node
        const pathLen = plus(prevPathLen, part.length - 1);

        // No condition check for root (no scope should be created)
        const isNotRoot = part.length !== 1;
        if (isNotRoot) {
            builder.push(ctx.createTopLevelCheck(part, prevPathLen, pathLen));
            builder.push('{');
        }

        if (this.store !== null)
            // Check whether the current length is equal to current path length
            builder.push(`if(path.length===${pathLen})${ctx.yield(this.store)};`);

        if (this.inert !== null) {
            const nextPathLen = plus(pathLen, 1);

            // Create an if statement for only one item
            if (this.inert.size === 1) {
                const { lastChild } = this.inert;

                builder.push(`if(path.charCodeAt(${pathLen})===${lastChild.key}){`);
                lastChild.compile(
                    ctx, nextPathLen, isChildParam, isNestedChildParam
                );
                builder.push('}');
            }

            // Create a switch for multiple items
            else {
                const { store } = this.inert;

                builder.push(`switch(path.charCodeAt(${pathLen})){`);
                for (const key in store) {
                    // Create a case statement for each char code
                    builder.push(`case ${key}:`);
                    store[key].compile(
                        ctx, nextPathLen, isChildParam, isNestedChildParam
                    );
                    builder.push('break;');
                }
                builder.push('}');
            }
        }

        if (this.params !== null) {
            // 'i': Current param index
            // 'p': Previous param index
            const { params } = this;

            // Reuse the variable if declared before
            const prevIndex = isChildParam ? 'p' : pathLen;

            // Declare a variable to save previous param index 
            // if current parameter is the second one
            if (isChildParam) {
                // Reuse the variable for third parameter and so on
                if (!isNestedChildParam) builder.push('let ');
                builder.push(`p=${pathLen};`);
            }

            const nextSlashIndex = ctx.searchPath('/', prevIndex),
                hasInert = params.inert !== null,
                hasStore = params.store !== null,
                { paramName } = params;

            // Declare the current param index variable if inert is found
            if (hasInert) {
                if (!isChildParam) builder.push('let ');
                builder.push(`i=${nextSlashIndex};`);
            }

            // Check slash index and get the parameter value if store is found
            if (hasStore) {
                builder.push(`if(${hasInert ? 'i' : nextSlashIndex}===-1){`);

                // Set param
                const value = ctx.slicePath(prevIndex);

                builder.push('c.params');
                builder.push(isChildParam
                    ? `.${paramName}=${value};`
                    : `={${paramName}:${value}};`);
                builder.push(ctx.yield(params.store));

                // End the if statement
                builder.push('}');
            }

            if (hasInert) {
                const value = ctx.substringPath(prevIndex, 'i');

                // Additional check if no store is provided (if store exists the previous part should match and return the store)
                if (!hasStore) builder.push(`if(i!==-1){`);

                // Assign param
                builder.push('c.params');
                builder.push(isChildParam
                    ? `.${paramName}=${value};`
                    : `={${paramName}:${value}};`
                );

                // Handle inert
                params.inert!.compile(
                    ctx, 'i+1', true,
                    // If this is the first parameter inert this will be false
                    isChildParam
                );

                if (!hasStore) builder.push('}');
            }
        }

        if (this.wildcardStore !== null) {
            const value = ctx.slicePath(pathLen);

            // Assign wildcard parameter
            builder.push('c.params');
            builder.push(isChildParam ? `.$=${value};` : `={$:${value}};`)
            builder.push(ctx.yield(this.wildcardStore));

            builder.push(';');
        }

        // Root does not include a check
        if (isNotRoot) builder.push('}');
    };
}
