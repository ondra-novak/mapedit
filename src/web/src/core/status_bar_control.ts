
import { computed, nextTick, ref } from 'vue'
import { MapFile } from './map_structs'
import { server } from './api'
import { AssetGroup } from './asset_groups'

type SaveFn = () => void|Promise<void>
type RevertFn = () => void|Promise<void>

class StatusBar {
    fnSave = ref<SaveFn | null>(null)
    fnRevert = ref<RevertFn | null>(null)
    changed = ref(false);
    inprogress = ref(false);

    cur_map_name = ref<string>();
    cur_map = ref<MapFile>();

    stack: [SaveFn|null, RevertFn|null, boolean][] =  [];


    registerSaveAndRevert (saveFn: SaveFn, revertFn: RevertFn): void  {
        this.fnSave.value = saveFn
        this.fnRevert.value = revertFn
        this.changed.value = false
    }
    setChangedFlag(flag: boolean): void {
        this.changed.value = flag
    }
    onFinalSave (): void {
        if (this.fnSave.value && this.changed.value) {
            this.fnSave.value();
        }
        this.fnSave.value = null
        this.fnRevert.value = null
        this.changed.value = false
    };
    
    async triggerSave(): Promise<void> {
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

    async triggerRevert (): Promise<void>  {
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

    async loadMap (mapname: string) : Promise<MapFile>   {
        if (this.cur_map_name.value === mapname) return this.cur_map.value!;
        const buff = await server.getDDLFile(mapname);
        this.cur_map.value = MapFile.from(buff);
        this.cur_map_name.value = mapname;
        return this.cur_map.value;
    };

    async reloadMap() :Promise<MapFile | null> {
        const name = this.cur_map_name.value;
        if (name) {
            this.cur_map_name.value = undefined;
            return await this.loadMap(name);
        } else {
            return null;
        }
    }

    async saveMap() : Promise<boolean> {
        const name = this.cur_map_name.value;
        if (name) {
            await server.putDDLFile(name, this.cur_map.value!.saveToArrayBuffer(), AssetGroup.MAPS);
            return true;
        } else {
            return false;
        }
    }
    
    getMapNameReactive() {
        return this.cur_map_name;
    }

    getMapReactive() {
        return this.cur_map;
    }
}


export default new StatusBar();