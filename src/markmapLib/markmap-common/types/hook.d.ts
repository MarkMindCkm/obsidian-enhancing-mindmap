export declare class Hook<T extends (...args: any[]) => void> {
    protected listeners: T[];
    tap(fn: T): () => void;
    revoke(fn: T): void;
    revokeAll(): void;
    call(...args: Parameters<T>): void;
}
