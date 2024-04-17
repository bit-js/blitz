export default [
    '/', '/about', '/login',
    '/api', '/api/:user', '/api/:user/:post',
    '/api/:user/:post/inspect', '/api/:user/info', '/api/:user/comment/:id',
    '/api/:user/comment/:id/inspect', '/:post', '/:post/view', '/:post/view/id',
    '/:post/view/user', '/:post/info', '/:post/comment/:id', '/:post/comment/:id/inspect',
    '/*', '/search/cats/*', '/search/names/*', '/search/:post/comment/*',
    '/search/:post/comment/user/:user/*'
];
