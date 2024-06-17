import router from './main';

export default function build() {
  return Bun.write(import.meta.dir + '/output.js', router.inline({
    routerImportSource: './main',
    contextImportSource: '@bit-js/blitz'
  }));
}
