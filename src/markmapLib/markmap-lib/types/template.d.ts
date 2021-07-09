import { JSItem, INode } from 'markmap-common';
import { IAssets } from './types';
export declare function fillTemplate(data: INode | undefined, assets: IAssets, extra?: {
    baseJs?: JSItem[];
    getOptions?: () => any;
} | (() => any)): string;
