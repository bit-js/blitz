import { BuildContext } from '../../types';
import { storePrefix } from '../constants';

const nonPrimitive = {
    number: true,
    string: true,
    boolean: true,
    symbol: false,
    function: false,
    object: false,
    undefined: true
}

export default function insertStore(ctx: BuildContext, value: any): string {
    // Inline primitives instead of storing as dependencies
    if (nonPrimitive[typeof value])
        return JSON.stringify(value);

    const key = storePrefix + ctx.currentID;
    ++ctx.currentID;

    ctx.paramsMap[key] = value;

    return key;
}
