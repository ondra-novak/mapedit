import type { ApiClient } from "@/core/api";
import type { AssetGroupType } from "@/core/asset_groups";


export interface IMissingFiles {
    reportMissingFile(api: ApiClient, filename: string, group: AssetGroupType): Promise<boolean>
};

let component_loaded : (x:IMissingFiles)=>void;
let component  = new Promise<IMissingFiles>(ok=>component_loaded = ok);

export function registerMissingFilesUI(object: IMissingFiles) {
    component_loaded(object);
}

export async function getDDLFileWithImport(api: ApiClient, filename: string, group: AssetGroupType) : Promise<ArrayBuffer | null> {
    while (true) {
        try {
            const data = await api.getDDLFile(filename);
            return data
        } catch (e) {
            console.warn(e);
        }

        const ifc = await component;
        const b = await ifc.reportMissingFile(api,filename,group);
        if (!b) return null;
    }
}


