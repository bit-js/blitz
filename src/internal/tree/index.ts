import splitPath from './splitPath';
import { InertStore, Node } from './nodes';
import type { MatchFunction, Options } from './types';

import BuildContext from '../compiler/context';

export class Tree {
    /**
     * The root node of the tree
     */
    root: Node | null = null;

    /**
     * Built-in static matching
     */
    staticMap: Record<string, any> | null = null;

    store(path: string, store: any): any {
        // If path includes parameters or wildcard add to the tree
        if (path.includes(':') || path.charCodeAt(path.length - 1) === 42)
            this.storeDynamic(path, store);

        // Static path matches faster with a map
        else this.storeStatic(path, store);

        return store;
    }

    /**
     * Store static path
     */
    storeStatic(path: string, store: any): void {
        // Path should not start or end with '/'
        if (path.charCodeAt(0) === 47) path = path.substring(1);

        const lastIdx = path.length - 1;
        if (path.charCodeAt(lastIdx) === 47) path = path.substring(0, lastIdx);

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

        const { inertParts, paramParts } = splitPath(path);
        let node = (this.root ??= new Node('/')), paramPartsIndex = 0;

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

        if (paramPartsIndex < paramParts.length)
            // The final part is a parameter
            node.param(paramParts[paramPartsIndex]).store ??= store;

        // The final part is a wildcard
        else if (isWildcard) node.wildcardStore ??= store;

        // The final part is static
        else node.store ??= store;
    }

    createStaticMatcher(options: Options, fallback: any): MatchFunction<any> {
        const { staticMap } = this;

        if (options.invokeResultFunction === true) {
            // Fallback needs to be callable
            const fnFallback = typeof fallback === 'function' ? fallback : () => fallback;
            return staticMap === null ? fallback : (ctx) => (staticMap[ctx.path] ?? fnFallback)(ctx);
        }

        return staticMap === null ? () => fallback : (ctx) => staticMap[ctx.path] ?? fallback;
    }

    /**
     * Compile to a RegExp matcher
     */
    compileRegex(options: Options, fallback: any): MatchFunction<any> {
        const { root } = this;
        // Do only static match if no dynamic routes exist
        if (root === null) return this.createStaticMatcher(options, fallback);
        const { staticMap } = this;

        const store: any[] = [];
        const pattern = new RegExp('^' + root.compileRegex(store).substring(2)); // Slice out first '\/'

        // Doing aggresive optimizations
        if (staticMap === null) {
            if (options.invokeResultFunction === true) {
                const fallbackCaller = typeof fallback === 'function' ? fallback : () => fallback;

                return fallbackCaller.length === 0
                    ? (ctx) => {
                        const match = ctx.path.match(pattern);
                        if (match === null) return fallbackCaller();

                        ctx.params = match.groups;
                        return store[match.indexOf('', 1)](ctx);
                    }
                    : (ctx) => {
                        const match = ctx.path.match(pattern);
                        if (match === null) return fallbackCaller(ctx);

                        ctx.params = match.groups;
                        return store[match.indexOf('', 1)](ctx);
                    };
            }

            return (ctx) => {
                const match = ctx.path.match(pattern);
                if (match === null) return fallback;

                ctx.params = match.groups;
                return store[match.indexOf('', 1)];
            }
        }

        // No codegen is allowed here
        if (options.invokeResultFunction === true) {
            const fallbackCaller = typeof fallback === 'function' ? fallback : () => fallback;

            return fallbackCaller.length === 0
                ? (ctx) => {
                    const { path } = ctx;
                    const staticMatch = staticMap[path];
                    if (typeof staticMatch !== 'undefined') return staticMatch;

                    const match = path.match(pattern);
                    if (match === null) return fallbackCaller();

                    ctx.params = match.groups;
                    return store[match.indexOf('', 1)](ctx);
                }
                : (ctx) => {
                    const { path } = ctx;
                    const staticMatch = staticMap[path];
                    if (typeof staticMatch !== 'undefined') return staticMatch;

                    const match = path.match(pattern);
                    if (match === null) return fallbackCaller(ctx);

                    ctx.params = match.groups;
                    return store[match.indexOf('', 1)](ctx);
                };
        }

        return (ctx) => {
            const { path } = ctx;
            const staticMatch = staticMap[path];
            if (typeof staticMatch !== 'undefined') return staticMatch;

            const match = path.match(pattern);
            if (match === null) return fallback;

            ctx.params = match.groups;
            return store[match.indexOf('', 1)];
        }
    }

    /**
     * Build a function
     */
    compile(options: Options, fallback: any): MatchFunction<any> {
        const { root } = this;
        // Do only static match if no dynamic routes exist
        if (root === null) return this.createStaticMatcher(options, fallback);
        const { staticMap } = this;

        // Global build context
        const ctx: BuildContext = new BuildContext(options, ['const{path}=c;']);

        // Create static routes check
        if (staticMap !== null)
            ctx.builder.push(`const m=${ctx.insert(staticMap)}[path];if(typeof m!=='undefined')${ctx.yieldToken('m')};`);

        // Create dynamic routes check
        root.compile(ctx, '0', false, false);

        // Only need the fallback if root wildcard does not exist
        if (root.wildcardStore === null) ctx.builder.push(ctx.yield(fallback));

        return ctx.build();
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
