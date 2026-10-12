// Form building blocks used inside sheets: the −/+ number stepper.

export function stepper(id, value, step, min) {
  return `<div class="stepper">
    <button type="button" data-step="-${step}" data-for="${id}" aria-label="−">−</button>
    <input id="${id}" type="number" inputmode="decimal" min="${min}" step="any" value="${value}">
    <button type="button" data-step="${step}" data-for="${id}" aria-label="+">+</button>
  </div>`;
}

// Makes the −/+ buttons work. stepFor(inputId) can override the step (e.g. 2.5 kg vs 5 lb).
export function wireSteppers(root, stepFor) {
  root.querySelectorAll('[data-step]').forEach(btn => {
    btn.onclick = () => {
      const input = root.querySelector('#' + btn.dataset.for);
      let step = parseFloat(btn.dataset.step);
      const custom = stepFor && stepFor(btn.dataset.for);
      if (custom) step = Math.sign(step) * custom;
      const min = parseFloat(input.min) || 0;
      input.value = Math.max(min, Math.round(((parseFloat(input.value) || 0) + step) * 100) / 100);
    };
  });
}

export const readNumber = (root, id, min = 0) => Math.max(min, parseFloat(root.querySelector('#' + id).value) || 0);
