import splitPath from './splitPath';
import { Node } from './nodes';
import type { MatchFunction, Options } from './types';

import BuildContext from '../compiler/context';
import { ctxName, ctxPathEndName, ctxPathName, staticMatch } from '../compiler/constants';

export class Tree<T> {
    /**
     * The root node of the tree
     */
    root: Node<T> = new Node('/');

    /**
     * The fallback result
     */
    fallback?: T;

    /**
     * Built-in static matching
     */
    staticMap: Record<string, T> | null = null;

    store(path: string, store: T): T {
        // If path includes parameters or wildcard add to the tree
        if (path.includes(':') || path.charCodeAt(path.length - 1) === 42)
            this.storeDynamic(path, store);
        // Static path matches faster with a map
        else
            this.storeStatic(path, store);

        return store;
    }

    /**
     * Store static path
     */
    storeStatic(path: string, store: T): void {
        // Path should not start with '/'
        if (path.charCodeAt(0) === 47) path = path.slice(1);
        if (path.charCodeAt(path.length - 1) === 47) path = path.slice(0, -1);

        if (this.staticMap === null) this.staticMap = {};
        this.staticMap[path] = store;
    }

    /**
     * Register a path
     */
    storeDynamic(path: string, store: T): void {
        // Path should start with '/'
        if (path.charCodeAt(0) !== 47) path = '/' + path;

        // Ends with '*'
        const isWildcard = path.charCodeAt(path.length - 1) === 42;
        if (isWildcard) path = path.slice(0, -1);

        const [inertParts, paramParts] = splitPath(path);
        let node = this.root, paramPartsIndex = 0;

        for (let i = 0, { length } = inertParts; i < length; ++i) {
            if (i !== 0) {
                // Set param on the node
                const params = node.param(paramParts[paramPartsIndex].slice(1));
                ++paramPartsIndex;

                // Set inert
                if (params.inert === null) {
                    node = params.inert = new Node(inertParts[i]);
                    continue;
                }

                node = params.inert;
            }

            let part = inertParts[i];
            for (let j = 0; ;) {
                if (j === part.length) {
                    if (j < node.part.length) {
                        const oldNode = node.clone(node.part.slice(j));

                        // Move the current node down
                        node.reset(part);
                        node.adopt(oldNode);
                    }

                    break;
                }

                // Add static child
                if (j === node.part.length) {
                    if (node.inert === null) node.inert = new Map();
                    else {
                        // Only perform hashing once instead of .has & .get
                        const inert = node.inert.get(part.charCodeAt(j));

                        // Re-run loop with existing static node
                        if (typeof inert !== 'undefined') {
                            node = inert;
                            part = part.slice(j);
                            j = 0;
                            continue;
                        }
                    }

                    // Create new node
                    const childNode = new Node<T>(part.slice(j));
                    node.inert.set(part.charCodeAt(j), childNode);
                    node = childNode;

                    break;
                }

                if (part[j] !== node.part[j]) {
                    // Split the node
                    const newChild = new Node<T>(part.slice(j));
                    const oldNode = node.clone(node.part.slice(j));

                    node.reset(node.part.slice(0, j));
                    node.adopt(oldNode);
                    node.adopt(newChild);

                    node = newChild;
                    break;
                }

                ++j;
            }
        }

        if (paramPartsIndex < paramParts.length) {
            // The final part is a parameter
            const params = node.param(paramParts[paramPartsIndex].slice(1));

            if (params.store === null) params.store = store;
        }

        // The final part is a wildcard
        if (isWildcard && node.wildcardStore === null) node.wildcardStore = store;

        // The final part is static
        if (node.store === null) node.store = store;
    }

    /**
     * Create static map check
     */
    createStaticCheck(ctx: BuildContext) {
        // Only need static check if static map exists
        return this.staticMap === null
            ? ''
            : `const ${staticMatch}=${ctx.put(this.staticMap)}[${ctxName}.${ctxPathName}];if(typeof ${staticMatch}!=='undefined')return ${staticMatch};`;
    }

    /**
     * Create dynamic path check
     */
    createDynamicCheck(ctx: BuildContext) {
        // Declare all necessary variables and compile the root node
        // Dynamic check should end with ';' or a close bracket
        return `const{${ctxPathName}}=${ctxName},{${ctxPathEndName}}=${ctxPathName};${this.root.compile(ctx, '0', false, false).join('')}`;
    }

    /**
     * Create fallback call
     */
    createFallbackCall(ctx: BuildContext) {
        // Only need the fallback if root wildcard does not exist
        return this.root.wildcardStore === null
            ? typeof this.fallback === 'undefined'
                ? 'return null'
                : `return ${ctx.put(this.fallback)}`
            : '';
    }

    /**
     * Build a function
     */
    compile(
        options: Options
    ): MatchFunction<T> {
        // Global context
        const ctx: BuildContext = new BuildContext(options);
        const body = `return ${ctxName}=>{${this.createStaticCheck(ctx)}${this.createDynamicCheck(ctx)}${this.createFallbackCall(ctx)}}`;

        // Build function with all registered dependencies
        return Function(...ctx.paramsKeys, body)(...ctx.paramsValues);
    }

    /**
     * Return the tree in string
     */
    debug(space?: number | string): string {
        return JSON.stringify(this.root, replaceValue, space);
    }
}

// Convert special values to a format that can be read by JSON.stringify
function replaceValue(_: string, value: any) {
    // Ignore null values
    if (value === null) return;

    // Convert inert map to object
    if (value instanceof Map) {
        const obj = {};

        // Convert char code to normal character
        for (const pair of value)
            obj[String.fromCharCode(pair[0])] = pair[1];

        return obj;
    }

    if (typeof value === 'function')
        return value.toString();

    return value;
}

// Export all from submodules
export * from './nodes';
export * from './types';
export { default as checkParam } from './checkParam';
export { default as splitPath } from './splitPath';
