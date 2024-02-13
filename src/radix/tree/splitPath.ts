export type PathParts = [
    inertParts: string[],
    paramParts: string[]
];

// Split inert and param parts
export default function splitPath(path: string): PathParts {
    const inertParts: string[] = [];
    const paramParts: string[] = [];

    let paramIdx = path.indexOf(':'), start = 0;
    while (paramIdx !== -1) {
        if (paramIdx !== start)
            inertParts.push(path.substring(start, paramIdx));

        start = path.indexOf('/', paramIdx + 1);
        if (start === -1) {
            paramParts.push(path.substring(paramIdx));
            return [inertParts, paramParts];
        }

        paramParts.push(path.substring(paramIdx, start));
        paramIdx = path.indexOf(':', start + 1);
    };

    inertParts.push(path.substring(start));
    return [inertParts, paramParts];
}

