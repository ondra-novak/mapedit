import { nextTick, type DirectiveBinding } from 'vue'

export default {
  mounted(el: HTMLTextAreaElement) {
    resize(el)
    el.addEventListener('input', () => resize(el))
  },
  updated(el: HTMLTextAreaElement) {
    resize(el)
  }
} as {
  mounted: (el: HTMLTextAreaElement, binding: DirectiveBinding) => void
  updated: (el: HTMLTextAreaElement, binding: DirectiveBinding) => void
}

function resize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  nextTick(()=>{
    el.style.height = el.scrollHeight + 'px'    
  });
}
