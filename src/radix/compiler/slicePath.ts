import type { BuildContext } from '../tree';
import { ctxPathName } from './constants';

export default function slicePath(idx: string, ctx: BuildContext): string {
    return idx === '0' ? ctxPathName : `${ctxPathName}.${ctx.substrStrategy}(${idx})`;
}
