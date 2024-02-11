import { BuildContext } from '../../types';
import insertStore from './insertStore';

export default (
    condition: string | null,
    handler: any,
    ctx: BuildContext,
    preReturn: string | null,
): string => // 
    (condition === null ? '' : 'if(' + condition + ')')
    + (preReturn === null ? '' : '{' + preReturn)
    + `return ${insertStore(ctx, handler)}`
    + (preReturn === null ? '' : '}') + ';';
