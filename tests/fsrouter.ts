import { FileSystemRouter } from '@bit-js/blitz';

// Directory scanner
const glob = new Bun.Glob('**/*');

// Router prototype
const router = new FileSystemRouter({
    on: Bun.file,
    scan: (dir) => glob.scanSync(dir)
});

// Get the matcher
const match = router.scan(`${import.meta.dir}/internals`);

export default {
    fetch(req: Request) {
        return new Response(match(req).result);
    }
}
