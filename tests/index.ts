import Blitz from '..';

// Simple app
const app = new Blitz();

app.put('GET', '/', ctx => ctx.send('Hi'));
app.put('GET', '/user/:id', ctx => ctx.json(ctx.params));

export default { fetch: app.build() };
