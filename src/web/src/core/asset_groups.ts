export const AssetGroup = {
    UNKNOWN: 0,
    WALLS:1,
    SOUNDS:2,
    MAPS:4,
    UI:7,
    ITEMS:8,
    ENEMIES:9,
    DIALOGS:11
} as const;

export const AssetGroupLabel =  Object.freeze(Object.fromEntries([
        [AssetGroup.WALLS,"Walls, arcs"],
        [AssetGroup.SOUNDS,"Sound effects"],
        [AssetGroup.MAPS, "Map support files"],
        [AssetGroup.UI, "UI and other"],
        [AssetGroup.ITEMS, "Items"],
        [AssetGroup.ENEMIES, "Enemies"],
        [AssetGroup.DIALOGS, "Dialogs ,shops"],
        [AssetGroup.UNKNOWN, "Unspecified group"]
]));


export type AssetGroupType = typeof AssetGroup[keyof typeof AssetGroup];