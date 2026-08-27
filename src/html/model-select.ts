import { escapeHtml } from "./layout";
import { MODEL_OPTIONS } from "../models";

export function modelSelect(selected = "", options: { compact?: boolean; autosubmit?: boolean } = {}): string {
  const autosubmit = options.autosubmit || options.compact;
  const select = `<select name="model"${autosubmit ? ' onchange="this.form.submit()"' : ""}>${[
    `<option value="">Default (env)</option>`,
    ...MODEL_OPTIONS.map((option) => {
      const isSelected = selected === option.id ? " selected" : "";
      return `<option value="${escapeHtml(option.id)}"${isSelected}>${escapeHtml(option.label)}</option>`;
    }),
  ].join("")}</select>`;
  if (options.compact) return select;
  return `<label>Model ${select}</label>`;
}
