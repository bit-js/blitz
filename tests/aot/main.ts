import Blitz from '@bit-js/blitz';

const router = new Blitz();

router.on('GET', '/', () => 0);
router.on('GET', '/user/:id', () => 1);
router.on('POST', '/json', () => 2);

export default router;
