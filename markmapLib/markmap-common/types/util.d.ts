import { IWrapContext, IDeferred } from './types';
export declare function getId(): string;
export declare function noop(): void;
export declare function walkTree<T>(tree: T, callback: (item: T, next: () => void, parent?: T) => void, key?: string): void;
export declare function arrayFrom<T>(arrayLike: ArrayLike<T>): T[];
export declare function flatMap<T, U>(arrayLike: ArrayLike<T>, callback: (item?: T, index?: number, thisObj?: ArrayLike<T>) => U | U[]): U[];
export declare function addClass(className: string, ...rest: string[]): string;
export declare function childSelector<T extends Element>(filter?: string | ((el: T) => boolean)): () => T[];
export declare function wrapFunction<T extends (...args: any[]) => any>(fn: T, { before, after }: {
    before?: (ctx: IWrapContext<T>) => void;
    after?: (ctx: IWrapContext<T>) => void;
}): T;
export declare function defer<T>(): IDeferred<T>;
export declare function memoize<T extends (...args: any[]) => any>(fn: T): T;
