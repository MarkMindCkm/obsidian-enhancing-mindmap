import { IWrapContext, Hook } from 'markmap-common';
export declare function createTransformHooks(): {
    parser: Hook<(md: any, features: any) => void>;
    htmltag: Hook<(ctx: IWrapContext<any>) => void>;
    /**
     * Indicate that the last transformation is not complete for reasons like
     * lack of resources and is called when it is ready for a new transformation.
     */
    retransform: Hook<() => void>;
};
