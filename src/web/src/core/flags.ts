import { computed, reactive, ref, watch, type Reactive, type Ref, type WritableComputedRef } from "vue";

export function useBitmaskCheckbox<T extends Record<string, number>>(
  mapping: T,
  initialValue = 0
): [
   Ref<number>, Record<string,WritableComputedRef<boolean> >
 ] {
  const bitmask = ref(initialValue);

  const checkboxes : Record<string,WritableComputedRef<boolean> > = {};

  for (const key in mapping) {
    const bit = mapping[key];
    checkboxes[key] = computed({
      get: () => (bitmask.value & bit) !== 0,
      set: (checked: boolean) => {
        console.log(checked);
        if (checked) bitmask.value |= bit;
        else bitmask.value &= ~bit;
      }
    });
  }

  return [ bitmask, checkboxes ];
}



export function useBitmaskCheckbox2<T extends Record<string, number> >(
    mapping: T, initialValue = 0) : [Ref<number>, Reactive<Record<keyof T,boolean> >] {

    const bitmask = ref(initialValue);
    const checkboxes = {} as Record<keyof T, boolean> ;
    for (const key in mapping) {
        checkboxes[key] = !!(initialValue & mapping[key]);
    }
    const rcheckboxes = reactive(checkboxes);
    watch([rcheckboxes],(nw)=>{
        bitmask.value  = 0;
        for (const key in nw[0]) {
            if (nw[0][key]) bitmask.value |= mapping[key];
        }
    },{deep:true});
    watch([bitmask],(nw)=>{
        for (const key in mapping) {
            checkboxes[key] = !!(nw[0] & mapping[key]);
        }        
    })

    return [bitmask, rcheckboxes];
}

export function setFlag(flg: number, mask: number, v: boolean) {
  return v?flg | mask:flg & ~mask;
}