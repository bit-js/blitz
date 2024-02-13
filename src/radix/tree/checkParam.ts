// Variable name check
const validStartChars = new Array<null | undefined>(123),
    validChars = new Array<null | undefined>(123);
// A - Z
for (let i = 65; i < 91; ++i)
    validChars[i] = validStartChars[i] = null;
// a - z
for (let i = 97; i < 123; ++i)
    validChars[i] = validStartChars[i] = null;
// $, _
validStartChars[36] = validStartChars[95]
    = validChars[36] = validChars[95] = null;
// 0 - 9
for (let i = 48; i < 58; ++i)
    validChars[i] = null;

export default function checkParam(param: string): string {
    if (param === '$')
        throw new Error('Parameter name should not be "$" to avoid collision with wildcard parameter');

    if (validStartChars[param.charCodeAt(1)] !== null)
        throw new Error(`Parameter name ("${param}") must follow JavaScript variable name format`);

    for (let i = 2, { length } = param; i < length; ++i)
        if (validChars[param.charCodeAt(i)] !== null)
            throw new Error(`Parameter name ("${param}") must follow JavaScript variable name format`);

    return param;
}

