import { test, expect } from 'bun:test';
import Blitz from '..';

// Simple app
const app = new Blitz();

app.put('GET', '/', () => new Response('Hi'));
app.put('GET', '/user/:id', ctx => new Response((ctx.params as any).id));

// Serve app
const server = Bun.serve(app);

// Test real stuff
test('Real server', async () => {
    const home = await fetch(server.url.href);
    expect(await home.text()).toBe('Hi');

    const user = await fetch(server.url.href + 'user/90');
    expect(await user.text()).toBe('90');
});


