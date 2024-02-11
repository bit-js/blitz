import { Node } from '../../tree';
import { BuildContext, } from '../../types';
import { ctxPathName } from '../constants';
import plus from './plus';

export default (
    ctx: BuildContext,
    node: Node<any>,
    prevPathLen: string, pathLen: string
): string => {
    // Faster than doing substring
    if (node.part.length < 15) {
        const result: string[] = [];

        for (let i = 1, { length } = node.part; i < length; ++i) {
            result.push(`if(${ctxPathName}.charCodeAt(${prevPathLen})===${node.part.charCodeAt(i)})`);
            prevPathLen = plus(prevPathLen, 1);
        }

        return result.join('');
    }

    return `if(${ctxPathName}.${ctx.substrStrategy}(${prevPathLen},${pathLen})==='${node.part.substring(1)}')`;
}
