import checkParam from "./checkParam";

export class ParamNode<T> {
    paramName: string;
    store: T | null = null;
    inert: Node<T> | null = null;

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
        this.inert = new Map();
        this.store = this.params = this.wildcardStore = null;
    }

    /**
     * Clone the current node with new part
     */
    clone(part: string): Node<T> {
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
        this.inert!.set(child.part.charCodeAt(0), child);
    }

    /**
     * Set parametric node
     */
    param(paramName: string): ParamNode<T> {
        checkParam(paramName);

        if (this.params === null)
            this.params = new ParamNode<T>(paramName);
        else if (this.params.paramName !== paramName)
            throw new Error(
                `Cannot create route with parameter "${paramName}" \
                because a route already exists with a different parameter name \
                ("${this.params.paramName}") in the same location`
            );

        return this.params;
    }
}
