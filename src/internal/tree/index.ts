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
        // Do path validation to avoid malformed paths
        if (path.charCodeAt(0) !== 47) throw new Error('Path should start with a slash');

        const { length } = path;
        const lastCharCode = path.charCodeAt(length - 1);
        if (length !== 1 && lastCharCode === 47) throw new Error('Path should not end with a slash');

        // If path includes parameters or wildcard add to the tree
        if (lastCharCode === 42 || path.includes(':')) (this.root ??= new Node('/')).insert(path, store);

        // Static path matches faster with a map
        else (this.staticMap ??= {})[path] ??= store;

        return store;
    }

    /**
     * Merge root node
     * @internal
     */
    mergeRoot(base: string, root: Node) {
        if (this.root === null) {
            // Two root at the same level
            if (base.length === 1) {
                this.root = root;
                return;
            } else
                this.root = new Node('/');
        }

        this.root.insert(base, null).mergeWithRoot(root);
    }

    /**
     * Merge static routes
     * @internal
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
            // Base should not be dynamic
            if (base.includes(':'))
                throw new Error(`Base cannot includes patterns, instead recieved: ${base}`);

            // Merge 
            const oldStaticMap = this.staticMap ??= {};
            for (const key in staticMap)
                oldStaticMap[key.length === 1 ? base : `${base}${key}`] ??= staticMap[key];
        }
    }

    /**
     * Set a tree as a children
     */
    merge(base: string, tree: Tree) {
        if (base.charCodeAt(0) !== 47) throw new Error('Path should start with a slash');

        const { length } = base;
        if (length !== 1 && base.charCodeAt(length - 1) === 47) throw new Error('Path should not end with a slash');

        // Split to two step
        const { staticMap, root } = tree;
        if (root !== null) this.mergeRoot(base, root);
        if (staticMap !== null) this.mergeStatic(base, staticMap);
    }

    /**
     * Build a function
     */
    compile(options: Options, fallback: any): Matcher {
        const { root } = this;

        // Do only static match if no dynamic routes exists
        if (this.root === null) {
            const { staticMap } = this;

            return options.invokeResultFunction === true
                ? staticMap === null ? fallback : (ctx) => (staticMap[ctx.path] ?? fallback)(ctx)
                : staticMap === null ? () => fallback : (ctx) => staticMap[ctx.path] ?? fallback;
        }

        const { staticMap } = this;

        // Global build context
        const builder = ['const {path}=c;'];
        const ctx: BuildContext = new BuildContext(options, builder);

        // Create static routes check
        if (staticMap !== null)
            builder.push(root === null
                ? `return ${ctx.inlineToken(`(${ctx.insert(staticMap)}[path]??${ctx.insert(fallback)})`)};`
                : `const m=${ctx.insert(staticMap)}[path];if(typeof m!=='undefined')return ${ctx.inlineToken('m')};`);

        if (root !== null) {
            // Create dynamic routes check
            root.compile(ctx, '1', false, false);

            // Only need the fallback if root wildcard does not exist
            if (root.wildcardStore === null) builder.push('return ' + ctx.inlineValue(fallback));
        }

        return ctx.build();
    }

    /**
      * Compile to a dynamic matcher
      */
    compileMatcher(options: Options, fallback: any): Matcher {
        const { root, staticMap } = this;

        // Do only static match if no dynamic routes exist
        if (root === null) return options.invokeResultFunction === true
            ? staticMap === null ? fallback : (ctx) => (staticMap[ctx.path] ?? fallback)(ctx)
            : staticMap === null ? () => fallback : (ctx) => staticMap[ctx.path] ?? fallback;

        if (staticMap === null)
            return options.invokeResultFunction === true
                ? (ctx) => (root.matchRoute(ctx.path, ctx.params = {}, 0) ?? fallback)(ctx)
                : (ctx) => root.matchRoute(ctx.path, ctx.params = {}, 0) ?? fallback;

        return options.invokeResultFunction === true
            ? (ctx) => {
                const { path } = ctx;
                return (staticMap[path] ?? root.matchRoute(path, ctx.params = {}, 0) ?? fallback)(ctx);
            } : (ctx) => {
                const { path } = ctx;
                return staticMap[path] ?? root.matchRoute(path, ctx.params = {}, 0) ?? fallback;
            }
    }
}
