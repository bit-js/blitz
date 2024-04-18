import type BuildContext from '../compiler/context';
import plus from '../compiler/plus';
import mergeRegExpParts from '../regex/mergeRegExpParts';
import splitPath from './splitPath';

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

    merge(node: ParamNode) {
        if (this.paramName !== node.paramName)
            throw new Error(
                `Cannot create merge route with parameter "${node.paramName}" \
                because a route already exists with a different parameter name \
                ("${this.paramName}") in the same location`
            );

        this.store ??= node.store;

        if (node.inert !== null) {
            if (this.inert === null) this.inert = node.inert;
            else this.inert.mergeWithInert(node.inert);
        }
    }

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

    put(item: Node) {
        this.lastChild = item;

        this.store[item.key] = item;

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
        this.key = `${part.charCodeAt(0)}`;
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
        const inert = new InertStore();
        inert.put(firstChild);

        this.inert = inert;
        this.setPart(part);
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
     * Store a node as an inert
     */
    setInert(node: Node) {
        const store = (this.inert ??= new InertStore()).store[node.key];

        if (typeof store === 'undefined') this.inert.put(node);
        else store.mergeWithInert(node);
    }

    /**
     * Insert a handler
     */
    insert(path: string, store: any) {
        let node: Node = this;

        // Path should start with '/'
        if (path.charCodeAt(0) !== 47) path = '/' + path;

        // Ends with '*'
        const isWildcard = path.charCodeAt(path.length - 1) === 42;
        if (isWildcard) path = path.slice(0, -1);

        const { inertParts, paramParts } = splitPath(path);
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
                        const inert = node.inert.store[`${inertPart.charCodeAt(j)}`];

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
                    const oldNode = node.clone(node.part.substring(j));

                    node.reset(node.part.substring(0, j), oldNode);
                    node.inert!.put(newChild);

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
     */
    cloneSelf() {
        return this.clone(this.part);
    }

    /**
     * Merge a node with a root node
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

            this.setPart(newNode.part);
            this.store = newNode.store;
            this.inert = newNode.inert;
            this.params = newNode.params;
            this.wildcardStore = newNode.wildcardStore;

            return;
        }

        // abc - abd
        this.reset(
            prefixEnd === 0 ? '/' : currentPart.substring(0, prefixEnd),
            this.clone(currentPart.substring(prefixEnd))
        );

        this.inert!.put(node.clone(otherPart.substring(prefixEnd)));
    }

    /**
     * Merge a node with a similar role
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
     * Compile to regex
     */
    compileRegex(resultStore: any[]): string {
        const parts: string[] = [];

        if (this.store !== null) {
            parts.push('$()');
            resultStore.push(this.store);
        }

        if (this.inert !== null) {
            const { inert: { store } } = this;

            for (const key in store)
                parts.push(store[key].compileRegex(resultStore));
        }

        if (this.params !== null) {
            const { params } = this;
            const paramParts: string[] = [];

            // Offset the param match
            resultStore.push(null);

            if (params.store !== null) {
                paramParts.push('$()');
                resultStore.push(params.store);
            };

            if (params.inert !== null)
                paramParts.push(params.inert.compileRegex(resultStore));

            parts.push(`(?<${params.paramName}>[^/]+)${mergeRegExpParts(paramParts)}`);
        }

        if (this.wildcardStore !== null) {
            resultStore.push(null);
            resultStore.push(this.wildcardStore);

            parts.push('(?<$>.+)$()');
        }

        return this.part.replace(/\//g, '\\/') + mergeRegExpParts(parts);
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
    key: null,
    wildcardStore: null
}

// Convert special values to a format that can be read by JSON.stringify
function replaceValue(key: string, value: any) {
    // Ignore null values
    if (value === null || key in ignoreKeys) return;

    if (typeof value === 'function')
        return value.toString();

    return value;
}