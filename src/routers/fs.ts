import { Radix } from '../internal';
import { Context } from '../types';

declare namespace Router {
    export type Style = (path: string) => string | null;
    export type DefaultStyle = keyof typeof defaultStyleMap;
    export type GetInfo<T> = (path: string) => T;

    export interface Options<T> {
        style?: DefaultStyle | Style;
        scan(dir: string): IterableIterator<string> | string[];
        on: GetInfo<T>;
    }
}

function trimPath(path: string) {
    const startExt = path.lastIndexOf('.');

    return startExt === -1
        ? (path.endsWith('/index')
            ? (path.length === 6 ? '/' : path.substring(path.length - 6))
            : path
        ) : (path.charCodeAt(startExt - 1) === 120
            && path.charCodeAt(startExt - 2) === 101
            && path.charCodeAt(startExt - 3) === 100
            && path.charCodeAt(startExt - 4) === 110
            && path.charCodeAt(startExt - 5) === 105
            ? (startExt === 6 ? '/' : path.substring(0, startExt - 6))
            : path.substring(0, startExt)
        );
}

/**
 * Default parsing for path
 */
const defaultStyleMap = {
    basic(path) {
        let bracketIdx = path.indexOf('[');
        let pathBuilder = path.charCodeAt(0) === 47 ? '' : '/';
        let startIdx = 0;

        while (bracketIdx !== -1) {
            pathBuilder += path.substring(startIdx, bracketIdx);
            if (path.charCodeAt(bracketIdx + 1) === 46
                && path.charCodeAt(bracketIdx + 2) === 46
                && path.charCodeAt(bracketIdx + 3) === 46
            ) return trimPath(pathBuilder + '*');

            pathBuilder += ':';

            startIdx = path.indexOf(']', bracketIdx);
            pathBuilder += path.substring(bracketIdx + 1, startIdx);

            ++startIdx;
            bracketIdx = path.indexOf('[', startIdx);
        }

        return trimPath(pathBuilder + path.substring(startIdx));
    },

    preserve(path) {
        return path.charCodeAt(0) === 47 ? path : '/' + path;
    }
} satisfies Record<string, Router.Style>;

/**
 * Router compile options
 */
const compileOptions = { invokeResultFunction: false };

/**
 * Normalize a file path
 */
function normalize(path: string) {
    return path.replace(/\/\/|\\\\|\\/g, '/');
}

/**
 * Parsed result with other request info
 */
class RequestContext<T> extends Context<any> {
    public result: T | null;
}

class Router<T> {
    static Context = RequestContext;

    readonly style: Router.Style;
    readonly on: Router.GetInfo<T>;
    readonly scanFiles: Router.Options<T>['scan'];

    constructor({ style, on, scan }: Router.Options<T>) {
        this.style = typeof style === 'undefined'
            ? defaultStyleMap.basic
            : typeof style === 'string' ? defaultStyleMap[style] : style;

        this.on = on;
        this.scanFiles = scan;
    }

    /**
     * Scan a directory and returns a matching function
     */
    scan(cwd: string = '.'): (req: Request) => RequestContext<T> {
        const { on, style, scanFiles } = this;

        const router = new Radix<T>();
        const files = scanFiles(cwd);

        // Optimize for arrays
        if (Array.isArray(files)) for (let i = 0, { length } = files; i < length; ++i) {
            const path = files[i];
            const route = style(path);
            if (route === null) continue;
            router.on(route, on(normalize(cwd + path)));
        }

        // For iterators
        else for (const path of files) {
            const route = style(path);
            if (route === null) continue;
            router.on(route, on(normalize(cwd + path)));
        }

        const match = router.buildMatcher(compileOptions, null);
        return (req: Request) => {
            const ctx = new RequestContext<T>(req);
            ctx.result = match(ctx);
            return ctx;
        };
    }
}

export default Router;
