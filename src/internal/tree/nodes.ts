import type BuildContext from '../compiler/context';
import plus from '../compiler/plus';
import splitPath from './splitPath';

/**
 * A parametric node
 */
export class ParamNode {
    name: string;
    store: any = null;
    inert: Node | null = null;

    constructor(name: string) {
        if (name === '$') throw new Error('Parameter name should not be "$" to avoid collision with wildcard parameter');
        this.name = name;
    }

    /**
     * Merge with another parametric node
     * @internal
     */
    merge(node: ParamNode) {
        if (this.name !== node.name)
            throw new Error(
                `Cannot create merge route with parameter "${node.name}" \
                because a route already exists with a different parameter name \
                ("${this.name}") in the same location`
            );

        this.store ??= node.store;

        if (node.inert !== null) {
            if (this.inert === null) this.inert = node.inert;
            else this.inert.mergeWithInert(node.inert);
        }
    }

    /**
     * Merge the inert with a root node
     * @internal
     */
    mergeWithRoot(node: Node) {
        if (this.inert === null) this.inert = node;
        else this.inert.mergeWithRoot(node);
    }

    debug() {
        return JSON.parse(JSON.stringify(this, replaceValue));
    }
}

export class InertStore {
    store: Record<string, Node> = {};

    size: number = 0;
    lastChild: Node;

    /**
     * Put an item with a new key
     * @internal
     */
    put(item: Node) {
        this.lastChild = item;
        this.store[item.part[0]] = item;
        ++this.size;
    }
}

/**
 * A static node
 */
export class Node {
    store: any = null;
    inert: InertStore | null = null;
    params: ParamNode | null = null;
    wildcardStore: any = null;

    /**
     * Create a node
     */
    constructor(public part: string) { }

    /**
     * Reset a node and add 1 child. Use this to move down a node
     * @internal
     */
    reset(part: string, firstChild: Node): void {
        const inert = new InertStore();
        inert.put(firstChild);

        this.inert = inert;
        this.part = part;
        this.store = this.params = this.wildcardStore = null;
    }

    /**
     * Reset a node and add 2 children. Use this to move down a node
     * @internal
     */
    split(part: string, firstChild: Node, secondChild: Node): void {
        const inert = new InertStore();
        inert.put(firstChild);
        inert.put(secondChild);

        this.inert = inert;
        this.part = part;
        this.store = this.params = this.wildcardStore = null;
    }

    /**
     * Clone the current node with new part
     * @internal
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
     * Store a node as an inert
     * @internal
     */
    setInert(node: Node) {
        const store = (this.inert ??= new InertStore()).store[node.part[0]];

        if (typeof store === 'undefined') this.inert.put(node);
        else store.mergeWithInert(node);
    }

    /**
     * Insert a handler
     * @internal
     */
    insert(path: string, store: any) {
        let node: Node = this;

        // Ends with '*'
        const lastIdx = path.length - 1;
        const isWildcard = path.charCodeAt(lastIdx) === 42;

        const { inertParts, paramParts } = splitPath(isWildcard ? path.substring(0, lastIdx) : path);
        let paramPartsIndex = 0;

        for (let i = 0, { length } = inertParts; i < length; ++i) {
            if (i !== 0) {
                // Set param on the node
                const params = node.param(paramParts[paramPartsIndex]);
                ++paramPartsIndex;

                // Set inert
                if (params.inert === null) {
                    node = params.inert = new Node(inertParts[i]);
                    continue;
                }

                node = params.inert;
            }

            let inertPart = inertParts[i];
            for (let j = 0; ;) {
                if (j === inertPart.length) {
                    if (j < node.part.length)
                        // Move the current node down
                        node.reset(inertPart, node.clone(node.part.substring(j)));

                    break;
                }

                // Add static child
                if (j === node.part.length) {
                    if (node.inert === null) node.inert = new InertStore();
                    else {
                        // Only perform hashing once instead of .has & .get
                        const inert = node.inert.store[inertPart[j]];

                        // Re-run loop with existing static node
                        if (typeof inert !== 'undefined') {
                            node = inert;
                            inertPart = inertPart.substring(j);
                            j = 0;
                            continue;
                        }
                    }

                    // Create new node
                    const childNode = new Node(inertPart.substring(j));
                    node.inert.put(childNode);
                    node = childNode;

                    break;
                }

                if (inertPart[j] !== node.part[j]) {
                    // Split the node
                    const newChild = new Node(inertPart.substring(j));

                    node.split(
                        node.part.substring(0, j),
                        node.clone(node.part.substring(j)), newChild
                    );

                    node = newChild;
                    break;
                }

                ++j;
            }
        }

        if (paramPartsIndex < paramParts.length) {
            const paramNode = node.param(paramParts[paramPartsIndex]);

            // The final part is a parameter
            paramNode.store ??= store;

            return paramNode;
        }

        // The final part is a wildcard
        else if (isWildcard) node.wildcardStore ??= store;

        // The final part is static
        else node.store ??= store;

        return node;
    }

    /**
     * Clone this
     * @internal
     */
    cloneSelf() {
        return this.clone(this.part);
    }

    /**
     * Merge a node with a root node
     * @internal
     */
    mergeWithRoot(node: Node) {
        const { part } = this;
        const { length } = part;

        // Both node is a slash
        if (length === 1)
            return this.mergeExact(node);

        // Store does not exist so can append '/' to path
        if ((this.store ??= node.store) === null) {
            if (part.charCodeAt(length - 1) !== 47) this.part += '/';
            this.mergeExact(node);
        }
        // Create a new root node and set as inert
        else {
            const newNode = new Node('/');
            newNode.mergeExact(node);
            this.setInert(newNode);
        }
    }

    /**
     * Merge a node with an inert node (same first character)
     * @internal
     */
    mergeWithInert(node: Node) {
        const currentPart = this.part;
        const otherPart = node.part;

        if (currentPart === otherPart)
            return this.mergeExact(node);

        const prefixEnd = commonPrefixEnd(currentPart, otherPart);

        // ab - abc
        if (prefixEnd === currentPart.length)
            return this.setInert(node.clone(otherPart.substring(prefixEnd)));

        // abc - ab
        if (prefixEnd === otherPart.length) {
            const newNode = node.cloneSelf();
            newNode.setInert(this.clone(currentPart.substring(prefixEnd)));

            this.part = newNode.part;
            this.store = newNode.store;
            this.inert = newNode.inert;
            this.params = newNode.params;
            this.wildcardStore = newNode.wildcardStore;

            return;
        }

        // abc - abd
        this.split(
            prefixEnd === 0 ? '/' : currentPart.substring(0, prefixEnd),
            this.clone(currentPart.substring(prefixEnd)),
            node.clone(otherPart.substring(prefixEnd))
        );
    }

    /**
     * Merge a node with a similar role
     * @internal
     */
    mergeExact(node: Node) {
        this.store ??= node.store;
        this.wildcardStore ??= node.wildcardStore;

        if (node.inert !== null) {
            if (this.inert === null) this.inert = node.inert;
            else {
                const newStore = node.inert.store;
                for (const key in newStore) this.setInert(newStore[key]);
            }
        }

        if (node.params !== null) {
            if (this.params === null) this.params = node.params;
            else this.params.merge(node.params);
        }
    }

    /**
     * Set parametric node
     * @internal
     */
    param(paramName: string): ParamNode {
        if (this.params === null)
            this.params = new ParamNode(paramName);
        else if (this.params.name !== paramName)
            throw new Error(
                `Cannot create route with parameter "${paramName}" \
                because a route already exists with a different parameter name \
                ("${this.params.name}") in the same location`
            );

        return this.params;
    }

    /**
     * Compile a node into string parts to merge later with tree.compile
     * @internal
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

        const hasStore = this.store !== null;
        if (hasStore)
            // Check whether the current length is equal to current path length
            builder.push(`if(length===${pathLen})${ctx.yield(this.store)};`);

        if (this.inert !== null) {
            const nextPathLen = plus(pathLen, 1);

            // Create an if statement for only one item
            if (this.inert.size === 1) {
                const { lastChild } = this.inert;

                builder.push(`if(path.charCodeAt(${pathLen})===${lastChild.part.charCodeAt(0)}){`);
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
                    builder.push(`case ${key.charCodeAt(0)}:`);
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

            const paramHasInert = params.inert !== null,
                paramHasStore = params.store !== null,
                { name } = params;

            // Declare the current param index variable if inert is found
            if (!isChildParam) builder.push('let ');
            builder.push(`i=${ctx.searchPath('/', prevIndex)};`);

            // Param should not be empty
            builder.push(`if(i!==${prevIndex}){`);

            // Check slash index and get the parameter value if store is found
            if (paramHasStore) {
                builder.push(`if(i===-1){`);

                // Set param
                const value = ctx.slicePath(prevIndex);

                builder.push('c.params');
                builder.push(isChildParam
                    ? `.${name}=${value};`
                    : `={${name}:${value}};`);
                builder.push(ctx.yield(params.store));

                // End the if statement
                builder.push('}');
            }

            if (paramHasInert) {
                const value = ctx.substringPath(prevIndex, 'i');

                // Additional check if no store is provided (if store exists the previous part should match and return the store)
                if (!paramHasStore) builder.push(`if(i!==-1){`);

                // Assign param
                builder.push('c.params');
                builder.push(isChildParam
                    ? `.${name}=${value};`
                    : `={${name}:${value}};`
                );

                // Handle inert
                params.inert!.compile(
                    ctx, 'i+1', true,
                    // If this is the first parameter inert this will be false
                    isChildParam
                );

                if (!paramHasStore) builder.push('}');
            }

            // Close the bracket for the first if statement 
            // That checks if parameter is empty
            builder.push('}');
        }

        if (this.wildcardStore !== null) {
            // Check if current path length is larger than the wildcard path
            if (!hasStore) builder.push(`if(length!==${pathLen}){`)

            const value = ctx.slicePath(pathLen);

            // Assign wildcard parameter
            builder.push('c.params');
            builder.push(isChildParam ? `.$=${value};` : `={$:${value}};`)
            builder.push(ctx.yield(this.wildcardStore));
            builder.push(';');

            // Close the if statement
            if (!hasStore) builder.push('}');
        }

        // Root does not include a check
        if (isNotRoot) builder.push('}');
    };

    /**
     * Match a route
     * @internal
     */
    matchRoute(path: string, params: any, startIndex: number) {
        const { part } = this;
        const { length } = path;

        const pathPartLen = part.length;
        const pathPartEndIndex = startIndex + pathPartLen;

        // Only check the pathPart if its length is > 1 since the parent has
        // already checked that the url matches the first character
        if (pathPartLen > 1) {
            if (pathPartEndIndex > length)
                return null;

            // Using a loop is faster for short strings
            if (pathPartLen < 15) {
                for (let i = 1, j = startIndex + 1; i < pathPartLen; ++i, ++j)
                    if (part[i] !== path[j]) return null;
            } else if (path.substring(startIndex, pathPartEndIndex) !== part) return null;
        }

        startIndex = pathPartEndIndex;

        // Reached the end of the URL (Does not match wildcard)
        if (startIndex === length) return this.store;

        if (this.inert !== null) {
            const staticChild = this.inert.store[path[startIndex]];

            if (typeof staticChild !== 'undefined') {
                const route = staticChild.matchRoute(path, params, startIndex);
                if (route !== null) return route;
            }
        }

        if (this.params !== null) {
            const { params } = this;
            const slashIndex = path.indexOf('/', startIndex);

            if (slashIndex !== startIndex) { // Params cannot be empty
                if (slashIndex === -1) {
                    if (params.store !== null) {
                        // This is much faster than using a computed property
                        params[params.name] = path.substring(startIndex);
                        return params.store;
                    }
                } else if (params.inert !== null) {
                    const route = params.inert.matchRoute(path, params, slashIndex);

                    if (route !== null) {
                        params[params.name] = path.substring(startIndex, slashIndex);
                        return route;
                    }
                }
            }
        }

        if (this.wildcardStore !== null) {
            params.$ = path.substring(startIndex);
            return this.wildcardStore;
        }

        return null;
    }

    debug() {
        return JSON.parse(JSON.stringify(this, replaceValue));
    }
}

function commonPrefixEnd(part: string, otherPart: string) {
    const minLen = Math.min(part.length, otherPart.length);

    for (let i = 1; i < minLen; ++i)
        if (part[i] !== otherPart[i])
            return i;

    return minLen;
}

const ignoreKeys = {
    lastChild: null,
};

// Convert special values to a format that can be read by JSON.stringify
function replaceValue(key: string, value: any) {
    // Ignore null values
    if (value === null || key in ignoreKeys) return;

    if (typeof value === 'function')
        return value.toString();

    return value;
}
