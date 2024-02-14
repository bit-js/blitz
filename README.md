# Blitz
The fastest JavaScript router.

```ts
import Blitz from '@bitjs/blitz';

// Create the router
const router = new Blitz();

// Register paths
router.put('GET', '/', f0);
router.put('POST', '/json', f1);
router.put('PUT', '/update/:id', f2);

// Get the fetch function (use with Bun, Cloudflare Worker and Deno)
const fetch = router.fetch;
```
