export interface ParamNode<T> {
    paramName: string
    store: T | null
    inert: Node<T> | null
}

export interface Node<T> {
    part: string
    store: T | null
    inert: Map<number, Node<T>> | null
    params: ParamNode<T> | null
    wildcardStore: T | null
}

// Necessary regex
const variableNameRegex = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
const staticRegex = /:.+?(?=\/|$)/;
const paramsRegex = /:.+?(?=\/|$)/g;

/**
 * Reset a node. Use this to move down a node then add children
 */
function assignNode(node: Node<any>, part: string): void {
    node.part = part;
    // Next step should be adding children
    node.inert = new Map();
    node.store = node.params = node.wildcardStore = null;
};

/**
 * Set a node as a child of the current node
 */
function setChild(node: Node<any>, child: Node<any>): void {
    node.inert!.set(child.part.charCodeAt(0), child);
};

/**
 * Create a parametric node and bind it to the current node
 */
function initParamNode(node: Node<any>, paramName: string): ParamNode<any> {
    if (!variableNameRegex.test(paramName))
        throw new Error(`Parameter name ("${paramName}") must follow JavaScript variable name format`);
    if (paramName === '$')
        throw new Error(`Parameter name ("${paramName}") should not be "$" to avoid name collision with wildcard`);

    if (node.params === null)
        node.params = { paramName, store: null, inert: null };
    else if (node.params.paramName !== paramName)
        throw new Error(
            `Cannot create route with parameter "${paramName}" \
                because a route already exists with a different parameter name \
                ("${node.params.paramName}") in the same location`
        );

    return node.params;
};

/**
 * Create a normal node
 */
function createNode(part: string): Node<any> {
    return {
        part, store: null, inert: null,
        params: null, wildcardStore: null
    }
}

/**
 * Clone a node and only change the part
 */
function cloneNode(node: Node<any>, part: string): Node<any> {
    return {
        part,
        store: node.store, inert: node.inert,
        params: node.params, wildcardStore: node.wildcardStore
    }
};

export class Tree<T> {
    root: Node<T> = createNode('/');

    store(path: string, store: T): T {
        // Path should start with '/'
        if (path.charCodeAt(0) !== 47) path = '/' + path;

        // Ends with '*'
        const isWildcard = path.charCodeAt(path.length - 1) === 42;
        if (isWildcard) path = path.slice(0, -1);

        const inertParts = path.split(staticRegex),
            paramParts = path.match(paramsRegex) ?? [];

        if (inertParts[inertParts.length - 1].length === 0) inertParts.pop();
        let node = this.root, paramPartsIndex = 0;

        for (let i = 0, { length } = inertParts; i < length; ++i) {
            let part = inertParts[i];

            if (i > 0) {
                // Set param on the node
                const params = initParamNode(node, paramParts[paramPartsIndex].slice(1));
                ++paramPartsIndex;

                // Set inert
                if (params.inert === null) {
                    node = params.inert = createNode(part);
                    continue;
                }

                node = params.inert;
            }

            for (let j = 0; ;) {
                if (j === part.length) {
                    if (j < node.part.length) {
                        const oldNode = cloneNode(node, node.part.slice(j));

                        // Move the current node down
                        assignNode(node, part);
                        setChild(node, oldNode);
                    }

                    break;
                }

                if (j === node.part.length) {
                    // Add static child
                    if (node.inert === null) node.inert = new Map();
                    else if (node.inert.has(part.charCodeAt(j))) {
                        // Re-run loop with existing static node
                        node = node.inert.get(part.charCodeAt(j))!;
                        part = part.slice(j);
                        j = 0;
                        continue;
                    }

                    // Create new node
                    const childNode = createNode(part.slice(j));
                    node.inert.set(part.charCodeAt(j), childNode);
                    node = childNode;

                    break;
                }

                if (part[j] !== node.part[j]) {
                    // Split the node
                    const newChild = createNode(part.slice(j));
                    const oldNode = cloneNode(node, node.part.slice(j));

                    assignNode(node, node.part.slice(0, j));
                    setChild(node, oldNode);
                    setChild(node, newChild);

                    node = newChild;
                    break;
                }

                ++j;
            }
        }

        if (paramPartsIndex < paramParts.length) {
            // The final part is a parameter
            const params = initParamNode(node, paramParts[paramPartsIndex].slice(1));

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
}
