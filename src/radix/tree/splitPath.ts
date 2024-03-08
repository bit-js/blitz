export class PathParts {
    inertParts: string[] = [];
    paramParts: string[] = []
};

// Split inert and param parts
export default function splitPath(path: string): PathParts {
    const parts = new PathParts();
    const { inertParts, paramParts } = parts;

    let paramIdx = path.indexOf(':'), start = 0;
    while (paramIdx !== -1) {
        if (paramIdx !== start)
            inertParts.push(path.substring(start, paramIdx));

        start = path.indexOf('/', paramIdx + 1);
        if (start === -1) {
            paramParts.push(path.substring(paramIdx));
            return parts;
        }

        paramParts.push(path.substring(paramIdx, start));
        paramIdx = path.indexOf(':', start + 1);
    };

    inertParts.push(path.substring(start));
    return parts;
}

