import { splitPath } from './splitPath';
import { Node } from './nodes';

export class Tree<T> {
    /**
     * The root node of the tree
     */
    root: Node<T> = new Node('/');

    /**
     * Register a path
     */
    store(path: string, store: T): T {
        // Path should start with '/'
        if (path.charCodeAt(0) !== 47) path = '/' + path;

        // Ends with '*'
        const isWildcard = path.charCodeAt(path.length - 1) === 42;
        if (isWildcard) path = path.slice(0, -1);

        const [inertParts, paramParts] = splitPath(path);
        let node = this.root, paramPartsIndex = 0;

        for (let i = 0, { length } = inertParts; i < length; ++i) {
            if (i !== 0) {
                // Set param on the node
                const params = node.param(paramParts[paramPartsIndex].slice(1));
                ++paramPartsIndex;

                // Set inert
                if (params.inert === null) {
                    node = params.inert = new Node(inertParts[i]);
                    continue;
                }

                node = params.inert;
            }

            let part = inertParts[i];
            for (let j = 0; ;) {
                if (j === part.length) {
                    if (j < node.part.length) {
                        const oldNode = node.clone(node.part.slice(j));

                        // Move the current node down
                        node.reset(part);
                        node.adopt(oldNode);
                    }

                    break;
                }

                // Add static child
                if (j === node.part.length) {
                    if (node.inert === null) node.inert = new Map();
                    else {
                        // Only perform hashing once instead of .has & .get
                        const inert = node.inert.get(part.charCodeAt(j));

                        // Re-run loop with existing static node
                        if (typeof inert !== 'undefined') {
                            node = inert;
                            part = part.slice(j);
                            j = 0;
                            continue;
                        }
                    }

                    // Create new node
                    const childNode = new Node<T>(part.slice(j));
                    node.inert.set(part.charCodeAt(j), childNode);
                    node = childNode;

                    break;
                }

                if (part[j] !== node.part[j]) {
                    // Split the node
                    const newChild = new Node<T>(part.slice(j));
                    const oldNode = node.clone(node.part.slice(j));

                    node.reset(node.part.slice(0, j));
                    node.adopt(oldNode);
                    node.adopt(newChild);

                    node = newChild;
                    break;
                }

                ++j;
            }
        }

        if (paramPartsIndex < paramParts.length) {
            // The final part is a parameter
            const params = node.param(paramParts[paramPartsIndex].slice(1));

            if (params.store === null) params.store = store;
            return params.store!;
        }

        if (isWildcard) {
            // The final part is a wildcard
            if (node.wildcardStore === null) node.wildcardStore = store;
            return node.wildcardStore!;
        }

        // The final part is static
        if (node.store === null) node.store = store;
        return node.store;
    }

    /**
     * Return the tree in string
     */
    debug(space?: number | string): string {
        return JSON.stringify(this.root, replaceValue, space);
    }
}

// Convert special values to a format that can be read by JSON.stringify
function replaceValue(_: string, value: any) {
    // Ignore null values
    if (value === null) return;

    // Convert inert map to object
    if (value instanceof Map) {
        const obj = {};

        // Convert char code to normal character
        for (const pair of value)
            obj[String.fromCharCode(pair[0])] = pair[1];

        return obj;
    }

    if (typeof value === 'function')
        return value.toString();

    return value;
}
