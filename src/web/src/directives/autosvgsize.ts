// vAutoviewBox.ts
import type { Directive } from 'vue'

export const vAutoSvgSize: Directive<SVGSVGElement, { padding?: number }> = {
  mounted(el, binding) {
    const padding = binding.value?.padding ?? 20

    const update = () => {
      const bbox = el.getBBox()

      const x = bbox.x - padding
      const y = bbox.y - padding
      const w = bbox.width + padding * 2
      const h = bbox.height + padding * 2

      el.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
      el.setAttribute('width', `${w}`)
      el.setAttribute('height', `${h}`)
    }

    // počkej až Vue domaluje obsah
    requestAnimationFrame(update)

    // uložíme si callback pro update
    ;(el as any).__autoviewboxUpdate = update
  },

  updated(el) {
    const update = (el as any).__autoviewboxUpdate
    if (update) requestAnimationFrame(update)
  }
}
