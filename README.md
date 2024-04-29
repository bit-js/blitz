# Blitz
The fastest JavaScript router.

```ts
import Blitz from '@bit-js/blitz';

// Create the router
const router = new Blitz();

// Register paths
router.put('GET', '/', () => new Response('Hi'));

// Wildcard parameter
router.put('GET', '/search/*', ctx => new Response(ctx.params.$));

// Path parameters
router.put('PUT', '/update/:id', ctx => new Response(ctx.params.id));

// Register another router with the same type as a subrouter
router.route('/api', anotherRouter);

// Get the fetch function (use with Bun and Deno)
const fetch = router.build();
```

## Patterns
Blitz supports URL params and wildcards. Wildcard like `/*` does not match `/`.

## Context
The request context contains:
- `path`: The request pathname (Always start with a slash).
- `pathStart`: The request pathname start index in the request URL.
- `pathEnd`: The request pathname end index in the request URL.
- `params`: Request URL parameters.
- `headers`: Response headers.
- `status`: Response status.
- `statusText`: Response status text.
- `req`: The raw request object.

## Other routers
Other utility routers.

### Edge router
The basic `Blitz` router only works on non-edge runtimes as those block the use of the `Function` constructor for code generation.

`EdgeRouter` works everywhere as it matches routes using a recursive approach.

```ts
import { EdgeRouter } from '@bit-js/blitz';

// Create the router
const router = new EdgeRouter();
```

API usage is the same as `Blitz`. 
`EdgeRouter` should be used in edge runtimes as `Blitz` is around 2x faster in any other scenarios. 

It is possible to re-use the matcher of `EdgeRouter` after adding more routes, unlike `Blitz`.
```ts
// Add some routes
router.put('GET', '/', () => new Response('Hi'));

// Match '/'
const fetch = router.build();

// Add another route
router.put('GET', '/user/:id', (ctx) => new Response(ctx.params.id));

// Fetch now handles both '/' and '/user/:id'
fetch(req);
```

### FS router
A cross-runtime file system router API.

Example usage with Bun:
```ts
import { FileSystemRouter } from '@bit-js/blitz';

// A directory scanner
const glob = new Bun.Glob('**/*');

// Router prototype
const router = new FileSystemRouter({
    // on(path): Return the metadata associated to the path to match later
    // This only run once while scanning to retrieve the metadata
    on: Bun.file,

    // Scan synchronously and return the paths as an iterator
    scan: (dir) => glob.scanSync(dir),

    // style(path): Convert relative file path to route pathname (optional)
    // Default to NextJS route path style
    style: 'basic',
});

// Get the matcher
const match = router.scan(`${import.meta.dir}/internals`);

// Serve with Bun
export default {
    fetch(req: Request) {
        // Result is the metadata returned by on(path)
        // In this case it is the file blob
        return new Response(match(req).result);
    }
}
```

### Route style
Route style is a function that accepts a relative path and returns the correct route pattern.
```ts
type Style = (path: string) => string | null;
```

If the return result is null the path will be ignored.

#### Default style
- `basic`: NextJS route style (wildcard only supports `[...]` and wildcard parameter name is always `$`).
- `preserve`: No modifications to the path.

#### Result
The result is a request context with `result` property is the matched result.
