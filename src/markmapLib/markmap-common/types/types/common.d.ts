export interface IHierarchy<T> {
    /**
     * type
     */
    t: string;
    /**
     * payload
     */
    p?: any;
    /**
     * children
     */
    c?: T[];
}
export interface INode extends IHierarchy<INode> {
    /**
     * depth
     */
    d?: number;
    /**
     * value
     */
    v: string;
}
export declare type JSScriptItem = {
    type: 'script';
    data: {
        src: string;
        async?: boolean;
        defer?: boolean;
    };
};
export declare type JSIIFEItem = {
    type: 'iife';
    data: {
        fn: (...args: any[]) => void;
        getParams?: (context: any) => void | any[];
    };
};
export declare type JSItem = JSScriptItem | JSIIFEItem;
export declare type CSSItem = {
    type: 'style' | 'stylesheet';
    data: any;
};
export interface IWrapContext<T extends (...args: any[]) => any> {
    args: Parameters<T>;
    result?: ReturnType<T>;
}
export interface IDeferred<T> {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error?: any) => void;
}
