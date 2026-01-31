import type { Directive } from "vue";

function applyEllipsis(el: SVGTextElement, maxWidth: number) {
  const fullText = el.textContent ?? "";
  if (!fullText) return;

  // nejdřív zkus celý text
  el.textContent = fullText;
  if (el.getComputedTextLength() <= maxWidth) {
    return;
  }

  let left = 0;
  let right = fullText.length;
  let result = "";

  // binární hledání (rychlejší než po znacích)
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const candidate = fullText.slice(0, mid) + "…";

    el.textContent = candidate;
    if (el.getComputedTextLength() <= maxWidth) {
      result = candidate;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  el.textContent = result || "…";
}

export const svgEllipsis: Directive<SVGTextElement, number> = {
  mounted(el, binding) {
    requestAnimationFrame(() => {
      applyEllipsis(el, binding.value);
    });
  },
  updated(el, binding) {
    requestAnimationFrame(() => {
      applyEllipsis(el, binding.value);
    });
  }
};
