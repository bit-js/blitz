export class ParamNode<T> {
    paramName: string;
    store: T | null;
    inert: Node<T> | null;

    constructor(name: string) {
        this.paramName = name;
    }
}

export class Node<T> {
    part: string;
    store: T | null = null;
    inert: Map<number, Node<T>> | null = null;
    params: ParamNode<T> | null = null;
    wildcardStore: T | null = null;

    /**
     * Create a node
     */
    constructor(part: string) {
        this.part = part;
    }

    /**
     * Reset a node. Use this to move down a node then add children
     */
    reset(part: string): void {
        this.part = part;

        // Next step should be adding children
        this.inert = this.store = this.params = this.wildcardStore = null;
    }

    /**
     * Clone the current node with new part
     */
    clone(part: string) {
        const node = new Node<T>(part);

        node.store = this.store;
        node.inert = this.inert;
        node.params = this.params;
        node.wildcardStore = this.wildcardStore;

        return node;
    }

    /**
     * Register a node as children
     */
    adopt(child: Node<T>): void {
        if (this.inert === null) this.inert = new Map();

        this.inert!.set(child.part.charCodeAt(0), child);
    }

    /**
     * Set parametric node
     */
    param(paramName: string) {
        if (!variableNameRegex.test(paramName))
            throw new Error(`Parameter name ("${paramName}") must follow JavaScript variable name format`);
        if (paramName === '$')
            throw new Error(`Parameter name ("${paramName}") should not be "$" to avoid name collision with wildcard`);

        if (this.params === null)
            this.params = { paramName, store: null, inert: null };
        else if (this.params.paramName !== paramName)
            throw new Error(
                `Cannot create route with parameter "${paramName}" \
                because a route already exists with a different parameter name \
                ("${this.params.paramName}") in the same location`
            );

        return this.params;
    }
}

// Necessary regex
const variableNameRegex = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
const staticRegex = /:.+?(?=\/|$)/;
const paramsRegex = /:.+?(?=\/|$)/g;

export class Tree<T> {
    root: Node<T> = new Node('/');

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
                const params = node.param(paramParts[paramPartsIndex].slice(1));
                ++paramPartsIndex;

                // Set inert
                if (params.inert === null) {
                    node = params.inert = new Node(part);
                    continue;
                }

                node = params.inert;
            }

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
}
