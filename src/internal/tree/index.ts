import { Node } from './nodes';
import type { Matcher, Options } from './types';

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

    /**
     * Register a path
     */
    store(path: string, store: any): any {
        // If path includes parameters or wildcard add to the tree
        if (path.includes(':') || path.charCodeAt(path.length - 1) === 42)
            (this.root ??= new Node('/')).insert(path, store);

        // Static path matches faster with a map
        else this.storeStatic(path, store);

        return store;
    }

    /**
     * Register a static path
     */
    storeStatic(path: string, store: any): void {
        // Path should not start or end with '/'
        if (path.charCodeAt(0) === 47) path = path.substring(1);

        const lastIdx = path.length - 1;
        if (path.charCodeAt(lastIdx) === 47) path = path.substring(0, lastIdx);

        this.staticMap ??= {};
        this.staticMap[path] ??= store;
    }

    getNode(path: string) {
        return (this.root ??= new Node('/')).insert(path, null);
    }

    /**
     * Merge root node 
     */
    mergeRoot(base: string, root: Node) {
        if (base.charCodeAt(0) !== 47) base = '/' + base;

        if (this.root === null) {
            // Two root at the same level
            if (base.length === 1) {
                this.root = root;
                return;
            } else
                this.root = new Node('/');
        }

        this.getNode(base).mergeWithRoot(root);
    }

    /**
     * Merge static routes
     */
    mergeStatic(base: string, staticMap: Record<string, any>) {
        // If base path is root
        if (base.length <= 1) {
            if (this.staticMap === null) this.staticMap = staticMap;
            else {
                const oldStaticMap = this.staticMap;
                for (const key in staticMap)
                    oldStaticMap[key] ??= staticMap[key];
            }
        } else {
            const { length } = base;

            // Base can be dynamic
            if (base.includes(':')) {
                // Put all static routes into a new node and merge
                const root = new Node('/');
                for (const key in staticMap)
                    root.insert(key, staticMap[key]);

                this.getNode(base).mergeWithRoot(root);
                return;
            }

            // Only one substring op
            const startIdx = base.charCodeAt(0) === 47 ? 1 : 0;
            const endIdx = base.charCodeAt(length - 1) === 47 ? length - 1 : length;

            if (startIdx !== 0 || endIdx !== length)
                base = base.substring(startIdx, endIdx);

            // Merge 
            const oldStaticMap = this.staticMap ??= {};
            for (const key in staticMap)
                oldStaticMap[key.length === 0 ? base : `${base}/${key}`] ??= staticMap[key];
        }
    }

    /**
     * Set a tree as a children
     */
    merge(base: string, tree: Tree) {
        const { staticMap, root } = tree;

        if (root !== null) this.mergeRoot(base, root);
        if (staticMap !== null) this.mergeStatic(base, staticMap);
    }

    createStaticMatcher(options: Options, fallback: any): Matcher {
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
    compileRegex(options: Options, fallback: any): Matcher {
        const { root } = this;
        // Do only static match if no dynamic routes exist
        if (root === null) return this.createStaticMatcher(options, fallback);
        const { staticMap } = this;

        const store: any[] = [null];
        const pattern = new RegExp('^' + root.compileRegex(store).substring(2)); // Slice out first '\/'

        // Doing aggresive optimizations
        if (staticMap === null) {
            if (options.invokeResultFunction === true) {
                return fallback.length === 0
                    ? (ctx) => {
                        const match = ctx.path.match(pattern);
                        if (match === null) return fallback();

                        ctx.params = match.groups;
                        return store[match.indexOf('', 1)](ctx);
                    }
                    : (ctx) => {
                        const match = ctx.path.match(pattern);
                        if (match === null) return fallback(ctx);

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
            return fallback.length === 0
                ? (ctx) => {
                    const { path } = ctx;
                    const staticMatch = staticMap[path];
                    if (typeof staticMatch !== 'undefined') return staticMatch;

                    const match = path.match(pattern);
                    if (match === null) return fallback();

                    ctx.params = match.groups;
                    return store[match.indexOf('', 1)](ctx);
                }
                : (ctx) => {
                    const { path } = ctx;
                    const staticMatch = staticMap[path];
                    if (typeof staticMatch !== 'undefined') return staticMatch;

                    const match = path.match(pattern);
                    if (match === null) return fallback(ctx);

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
    compile(options: Options, fallback: any): Matcher {
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
}


