import Blitz from '..';

// Simple app
const app = new Blitz();

app.put('GET', '/', () => new Response('Hi'));
app.put('GET', '/user/:id', ctx => new Response((ctx.params as any).id));

export default { fetch: app.build() };
