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

/**
 * Default parsing for path
 */
const defaultStyleMap = {
    basic(path) {
        let startBracketIdx = path.indexOf('[');

        // Slice out extension
        if (startBracketIdx === -1) {
            const startPathExt = path.lastIndexOf('.');
            if (startPathExt === -1) return path.endsWith('index') ? path.substring(0, path.length - 5) : path;

            // [47, 105, 110, 100, 101, 120] -> /index
            if (path.charCodeAt(startPathExt - 1) === 120) {
                if (path.charCodeAt(startPathExt - 2) === 101) {
                    if (path.charCodeAt(startPathExt - 3) === 100) {
                        if (path.charCodeAt(startPathExt - 4) === 110) {
                            if (path.charCodeAt(startPathExt - 5) === 105) {
                                if (startPathExt === 5 || path.charCodeAt(startPathExt - 6) === 47)
                                    return path.substring(0, startPathExt - 5);
                            }
                        }
                    }
                }
            }

            return path.substring(0, startPathExt);
        }

        let pathBuilder = '';
        let startIdx = 0;

        do {
            pathBuilder += path.substring(startIdx, startBracketIdx);

            // [...]
            if (path.charCodeAt(startBracketIdx + 1) === 46) {
                if (path.charCodeAt(startBracketIdx + 2) === 46) {
                    if (path.charCodeAt(3) === 46)
                        // eslint-disable-next-line
                        return pathBuilder + '*';
                }
            }

            pathBuilder += ':';

            startIdx = path.indexOf(']', startBracketIdx);
            pathBuilder += path.substring(startBracketIdx + 1, startIdx);

            ++startIdx;
            startBracketIdx = path.indexOf('[', startIdx);
        } while (startBracketIdx !== -1);

        // Slice out extension
        const startPathExt = path.lastIndexOf('.');

        if (startPathExt === -1)
            pathBuilder += path.endsWith('index') ? path.substring(startIdx, path.length - 5) : path.substring(startIdx);

        else if (path.charCodeAt(startPathExt - 1) === 120) {
            if (path.charCodeAt(startPathExt - 2) === 101) {
                if (path.charCodeAt(startPathExt - 3) === 100) {
                    if (path.charCodeAt(startPathExt - 4) === 110) {
                        if (path.charCodeAt(startPathExt - 5) === 105) {
                            if (startPathExt === 5 || path.charCodeAt(startPathExt - 6) === 47)
                                pathBuilder += path.substring(0, startPathExt - 5);
                        }
                    }
                }
            }
        }

        return pathBuilder;
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
            : typeof style === 'string' ?
                defaultStyleMap[style]
                : style;

        this.on = on;
        this.scanFiles = scan;
    }

    /**
     * Scan a directory and returns a matching function
     */
    scan(cwd: string = '.'): (req: Request) => RequestContext<T> {
        const { on, style, scanFiles } = this;

        const router = new Radix<T>();
        for (const path of scanFiles(cwd)) {
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
