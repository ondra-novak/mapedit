
export default {
   mounted(el: HTMLInputElement) {
    const handler = () => {
      if (el.type !== 'number') return;

      const min = parseFloat(el.min);
      const max = parseFloat(el.max);
      let val = parseFloat(el.value);

      if (!isNaN(min) && val < min) {
        el.valueAsNumber = min;
        el.dispatchEvent(new Event('input')); // nutné pro Vue model
      }
      if (!isNaN(max) && val > max) {
        el.valueAsNumber = max;
        el.dispatchEvent(new Event('input'));
      }
    };

    el.addEventListener('change', handler);
  }
}
