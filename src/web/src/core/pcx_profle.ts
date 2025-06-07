import { PCX, PCXProfile, type PCXProfileType } from '@/core/pcx';
import { AssetGroup, type AssetGroupType } from '@/core/asset_groups';


export function determineProfile(file:string, group:AssetGroupType, pcx?: PCX) : PCXProfileType {
    switch (group) {
        case AssetGroup.WALLS: return (pcx && pcx.width == 640)?PCXProfile.default:PCXProfile.wall;
        case AssetGroup.ITEMS: return PCXProfile.item;
        case AssetGroup.ENEMIES: return PCXProfile.enemy;
        default: return PCXProfile.transp0;                                
    }
}
