
import { computed, nextTick, ref } from 'vue'

type SaveFn = () => void|Promise<void>
type RevertFn = () => void|Promise<void>

const fnSave = ref<SaveFn | null>(null)
const fnRevert = ref<RevertFn | null>(null)
const changed = ref(false);
const inprogress = ref(false);

const stack: [SaveFn|null, RevertFn|null, boolean][] =  [];

export default {

    registerSaveAndRevert: (saveFn: SaveFn, revertFn: RevertFn): void => {
        fnSave.value = saveFn
        fnRevert.value = revertFn
        changed.value = false
    },
    setChangedFlag: (flag: boolean): void => {
        changed.value = flag
    },
    onFinalSave: (): void => {
        if (fnSave.value && changed.value) {
            fnSave.value();
        }
        fnSave.value = null
        fnRevert.value = null
        changed.value = false
    },
    
    triggerSave: async (): Promise<void> => {
        if (fnSave.value && changed.value){
            const n = fnSave.value();
            inprogress.value = true;
            try {
                if (n) await n;
                changed.value = false;
            } catch (e) {
                alert("Failed to save page:" + e);                
            }
            inprogress.value = false;
        } 
    },

    triggerRevert: async (): Promise<void> => {
        if (fnRevert.value) {
            const n = fnRevert.value()
            inprogress.value = true;
            try {
                if (n) await n;                
            } catch (e) {
                //....                
            }
            inprogress.value = false;
            changed.value = false;
        }
    },
    visible: computed(()=>!!(fnSave.value && fnRevert.value) ),
    enabled: computed(()=>changed.value && !inprogress.value),


    push: () => {
        stack.push([fnSave.value,fnRevert.value,changed.value])
        fnSave.value=null;
        fnRevert.value=null;
        changed.value = false;
    },
    pop: () => {
        const x = stack.pop();
        if (x) {
            nextTick(()=>{
                fnSave.value = x[0];
                fnRevert.value = x[1];
                changed.value = x[2];
            })
        }
    }
}
