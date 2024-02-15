import { test, expect } from 'bun:test';
import Blitz from '..';

// Simple app
const app = new Blitz();

app.put('GET', '/', () => new Response('Hi'));
app.put('GET', '/user/:id', ctx => new Response((ctx.params as any).id));

// Fetch
const { fetch } = app;
async function get(path: string): Promise<string> {
    return fetch(new Request(`http://localhost:3000${path}`)).text();
}

// Test real stuff
test('Real server', async () => {
    expect(await get('/')).toBe('Hi');
    expect(await get('/user/90')).toBe('90');
});


