import type { BuildContext } from '../tree';
import { storePrefix } from './constants';

export default function insertStore(ctx: BuildContext, value: any): string {
    if (typeof value !== 'function' && typeof value !== 'symbol' && typeof value !== 'object')
        return JSON.stringify(value);

    const key = storePrefix + ctx.currentID;
    ++ctx.currentID;

    ctx.paramsKeys.push(key);
    ctx.paramsValues.push(value);

    return key;
}
