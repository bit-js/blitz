import splitPath from './splitPath';
import { Node } from './nodes';
import type { MatchFunction, Options } from './types';

import BuildContext from '../compiler/context';
import { ctxName, staticMatch } from '../compiler/constants';
import { defaultArgs } from '../compiler/getArgs';

export class Tree {
    /**
     * The root node of the tree
     */
    root: Node = new Node('/');

    /**
     * Built-in static matching
     */
    staticMap: Record<string, any> | null = null;

    store(path: string, store: any): any {
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
    storeStatic(path: string, store: any): void {
        // Path should not start with '/'
        if (path.charCodeAt(0) === 47) path = path.slice(1);
        if (path.charCodeAt(path.length - 1) === 47) path = path.slice(0, -1);

        this.staticMap ??= {};
        this.staticMap[path] ??= store;
    }

    /**
     * Register a path
     */
    storeDynamic(path: string, store: any): void {
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
                    const childNode = new Node(part.slice(j));
                    node.inert.set(part.charCodeAt(j), childNode);
                    node = childNode;

                    break;
                }

                if (part[j] !== node.part[j]) {
                    // Split the node
                    const newChild = new Node(part.slice(j));
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

        if (paramPartsIndex < paramParts.length)
            // The final part is a parameter
            node.param(paramParts[paramPartsIndex].slice(1)).store ??= store;

        // The final part is a wildcard
        if (isWildcard) node.wildcardStore ??= store;

        // The final part is static
        else node.store ??= store;
    }

    /**
     * Create static map check
     */
    createStaticCheck(ctx: BuildContext, options: Options): string {
        // Only need static check if static map exists
        return this.staticMap === null ? '' : `const ${staticMatch}=${ctx.insert(this.staticMap)}[${ctxName}.path];if(typeof ${staticMatch}!=='undefined')return ${staticMatch}${options.invokeResultFunction ? defaultArgs : ''};`;
    }

    /**
     * Create dynamic path check
     */
    createDynamicCheck(ctx: BuildContext): string {
        // Declare all necessary variables and compile the root node
        // Dynamic check should end with ';' or a close bracket
        return `const{path}=${ctxName};${this.root.compile(ctx, '0', false, false).join('')}`;
    }

    /**
     * Create fallback call
     */
    createFallbackCall(ctx: BuildContext, fallback: any): string {
        // Only need the fallback if root wildcard does not exist
        return this.root.wildcardStore === null ? ctx.yield(fallback) : '';
    }

    /**
     * Build a function
     */
    compile(options: Options, fallback: any): MatchFunction<any> {
        // Global context
        const ctx: BuildContext = new BuildContext(options);
        const body = `return ${ctxName}=>{${this.createStaticCheck(ctx, options)}${this.createDynamicCheck(ctx)}${this.createFallbackCall(ctx, fallback)}}`;

        return ctx.build(body);
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

