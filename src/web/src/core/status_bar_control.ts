
import { computed, nextTick, ref } from 'vue'
import { server } from './api'
import { AssetGroup } from './asset_groups'
import { MapFile, MapPalettes } from './map_structs'
import { Document } from '@/utils/document'

type SaveFn = () => void|Promise<any>
type RevertFn = () => void|Promise<any>

class StatusBar {
    fnSave = ref<SaveFn | null>(null)
    fnRevert = ref<RevertFn | null>(null)
    changed = ref(false);
    inprogress = ref(false);

    cur_map_name = ref<string>();
    cur_map = new Document<MapFile>(new MapFile);
    cur_map_palettes = new MapPalettes;
    popup_map_open = ()=>{};
    on_map_open=()=>{};

    stack: [SaveFn|null, RevertFn|null, boolean][] =  [];
    onFinalSave = ()=>{this.onFinalSaveImpl()};


    registerSaveAndRevert (saveFn: SaveFn, revertFn: RevertFn): void  {
        this.fnSave.value = saveFn
        this.fnRevert.value = revertFn
        this.changed.value = false
    }
    setChangedFlag(flag: boolean): void {
        this.changed.value = flag
    }
    protected onFinalSaveImpl (): void {
        if (this.fnSave.value && this.changed.value) {
            this.fnSave.value();
        }
        this.fnSave.value = null
        this.fnRevert.value = null
        this.changed.value = false
    };
    
    async triggerSave(): Promise<any> {
        if (this.fnSave.value && this.changed.value){
            const n = this.fnSave.value();
            this.inprogress.value = true;
            try {
                if (n) await n;
                this.changed.value = false;
            } catch (e) {
                alert("Failed to save page:" + e);                
            }
            this.inprogress.value = false;
        } 
    };

    async triggerRevert (): Promise<any>  {
        if (this.fnRevert.value) {
            const n = this.fnRevert.value()
            this.inprogress.value = true;
            try {
                if (n) await n;                
            } catch (e) {
                //....                
            }
            this.inprogress.value = false;
            this.changed.value = false;
        }
    }
    visible = computed(()=>!!(this.fnSave.value && this.fnRevert.value));
    enabled = computed(()=>this.changed.value && !this.inprogress.value);

    push() {
        this.stack.push([this.fnSave.value,this.fnRevert.value,this.changed.value])
        this.fnSave.value=null;
        this.fnRevert.value=null;
        this.changed.value = false;
    }

    pop() {
        const x = this.stack.pop();
        if (x) {
            nextTick(()=>{
                this.fnSave.value = x[0];
                this.fnRevert.value = x[1];
                this.changed.value = x[2];
            })
        }
    };

    async loadMap (mapname: string) : Promise<Document<MapFile> >   {
        if (this.cur_map_name.value === mapname) return this.cur_map;
        try {
            const buff = await server.getDDLFile(mapname);
            const mapdata = MapFile.from(buff);            
            this.cur_map.reset(mapdata[0]);
            this.cur_map_palettes = mapdata[1];
            this.cur_map_name.value = mapname;            
        } catch (e) {
            this.cur_map.reset(new MapFile);
            this.cur_map_name.value = mapname;            
        }
        this.on_map_open();
        return this.cur_map;
    };

    async reloadMap() :Promise<Document<MapFile> >  {
        const name = this.cur_map_name.value;
        if (name) {
            this.cur_map_name.value = undefined;
            return await this.loadMap(name);
        } else {
            return this.cur_map;
        }
    }

    async saveMap() : Promise<boolean> {
        const name = this.cur_map_name.value;
        if (name) {
            await server.putDDLFile(name, this.cur_map.get_current().saveToArrayBuffer(), AssetGroup.MAPS);
            return true;
        } else {
            return false;
        }
    }

    getMapPalettes():MapPalettes{
        return this.cur_map_palettes;
    }
    
    getMapNameReactive() {
        return this.cur_map_name;
    }

    getMapReactive() {
        return this.cur_map;
    }

    openMapDialog() {
        this.popup_map_open();
    }
    onMapOpen(event: ()=>void) {
        this.on_map_open = event;
    }
}


export default new StatusBar();