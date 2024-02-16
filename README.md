# Blitz
The fastest JavaScript router.

```ts
import Blitz from '@bitjs/blitz';

// Create the router
const router = new Blitz();

// Register paths
router.put('GET', '/', () => new Response('Hi'));

// Wildcard parameter (does not start with a slash)
router.put('GET', '/search/*', ctx => new Response(ctx.params.$));

// Path parameters
router.put('PUT', '/update/:id', ctx => new Response(ctx.params.id));

// Get the fetch function (use with Bun, Cloudflare Worker and Deno)
const fetch = router.build();
```

## Context
The request context.
- `path`: The request pathname (Does not start with a slash).
- `pathStart`: The request pathname start index in the request URL.
- `pathEnd`: The request pathname end index in the request URL.
- `params`: Request URL parameters.
- `headers`: Response headers.
- `status`: Response status.
- `statusText`: Response status text.
- `req`: The raw request object.
