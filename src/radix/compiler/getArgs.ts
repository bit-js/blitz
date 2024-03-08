export const defaultArgs = '(c)';

export default function getArgs(value: Function) {
    return value.length === 0 ? '()' : defaultArgs;
}
