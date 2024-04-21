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
        const { length } = path;

        if (length < 2)
            (this.staticMap ??= {})[''] ??= store;
        else {
            const startIdx = path.charCodeAt(0) === 47 ? 1 : 0;
            const endIdx = path.charCodeAt(length - 1) === 47 ? length - 1 : length;

            (this.staticMap ??= {})[startIdx === 0 && endIdx === length ? path : path.substring(startIdx, endIdx)] ??= store;
        }
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

        (this.root ??= new Node('/')).insert(base, null).mergeWithRoot(root);
    }

    /**
     * Merge static routes
     */
    mergeStatic(base: string, staticMap: Record<string, any>) {
        // If base path is root
        if (base.length < 2) {
            if (this.staticMap === null) this.staticMap = staticMap;
            else {
                const oldStaticMap = this.staticMap;
                for (const key in staticMap)
                    oldStaticMap[key] ??= staticMap[key];
            }
        } else {
            // Base can be dynamic
            if (base.includes(':')) {
                // Put all static routes into a new node and merge
                const root = this.root ??= new Node('/');
                for (const key in staticMap)
                    root.insert(key.length === 0 ? base : `${base}/${key}`, staticMap[key]);

                return;
            }

            // Only one substring op
            const startIdx = base.charCodeAt(0) === 47 ? 1 : 0;
            const { length } = base;
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

    /**
     * Create static matcher only
     */
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
     * Build a function
     */
    compile(options: Options, fallback: any): Matcher {
        const { root } = this;
        // Do only static match if no dynamic routes exist
        if (root === null) return this.createStaticMatcher(options, fallback);

        const { staticMap } = this;

        // Global build context
        const builder = ['const{path}=c;'];
        const ctx: BuildContext = new BuildContext(options, builder);

        // Create static routes check
        if (staticMap !== null)
            builder.push(`const m=${ctx.insert(staticMap)}[path];if(typeof m!=='undefined')${ctx.yieldToken('m')};`);

        // Create dynamic routes check
        root.compile(ctx, '0', false, false);

        // Only need the fallback if root wildcard does not exist
        if (root.wildcardStore === null) builder.push(ctx.yield(fallback));

        return ctx.build();
    }

    /**
      * Compile to a dynamic matcher
      */
    compileMatcher(options: Options, fallback: any): Matcher {
        const { root } = this;
        // Do only static match if no dynamic routes exist
        if (root === null) return this.createStaticMatcher(options, fallback);

        const search = root.matchRoute.bind(root);
        const { staticMap } = this;

        if (staticMap === null)
            return options.invokeResultFunction === true
                ? (ctx) => (search(ctx) ?? fallback)(ctx)
                : (ctx) => search(ctx) ?? fallback;

        return options.invokeResultFunction === true
            ? (ctx) => (staticMap[ctx.path] ?? search(ctx, -1) ?? fallback)(ctx)
            : (ctx) => staticMap[ctx.path] ?? search(ctx, -1) ?? fallback;
    }
}
