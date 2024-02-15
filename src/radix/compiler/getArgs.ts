import { ctxName } from './constants';

export const defaultArgs = `(${ctxName})`;

export default function getArgs(value: Function) {
    return value.length !== 0 ? defaultArgs : '()';
}
