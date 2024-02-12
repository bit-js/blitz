import { BuildContext } from '../../types';
import { storePrefix } from '../constants';

export default function insertStore(ctx: BuildContext, value: any): string {
    const key = storePrefix + ctx.currentID;
    ++ctx.currentID;

    ctx.paramsKeys.push(key);
    ctx.paramsValues.push(value);

    return key;
}
