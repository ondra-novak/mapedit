export const AssetGroup = {
    UNKNOWN: 0,
    WALLS:1,
    SOUNDS:2,
    FONTS:3,
    MAPS:4,
    MUSIC: 5,    
    UI:7,
    ITEMS:8,
    ENEMIES:9,
    DIALOGS:11
} as const;

export const AssetGroupLabel =  Object.freeze(Object.fromEntries([
        [AssetGroup.WALLS,"Walls, arcs"],
        [AssetGroup.SOUNDS,"Sound effects"],
        [AssetGroup.FONTS, "Fonts"],
        [AssetGroup.MAPS, "Map support files"],
        [AssetGroup.MUSIC, "Music"],
        [AssetGroup.UI, "UI and other"],
        [AssetGroup.ITEMS, "Items"],
        [AssetGroup.ENEMIES, "Enemies"],
        [AssetGroup.DIALOGS, "Dialogs ,shops"],
        [AssetGroup.UNKNOWN, "Unspecified group"]
]));



export type AssetGroupType = typeof AssetGroup[keyof typeof AssetGroup];

export function groupFromNumber(n: number) : keyof typeof AssetGroup {
    const r = Object.entries(AssetGroup).find(x=>x[1] == n);
    if (r) {
        return r[0] as keyof typeof AssetGroup;
    } else {
        return "UNKNOWN"
    }
}