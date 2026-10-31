import type { WebDriver } from "selenium-webdriver";
import { isBotCheckText } from "./steps";

export interface Field {
  kind: "select" | "textarea";
  question: string;
  options: string[];
  required: boolean;
  filled: boolean;
}

interface FieldUpdate {
  index: number;
  value: string;
}

/** Reads employer questions currently on the page. */
export async function readFields(driver: WebDriver): Promise<Field[]> {
  return driver.executeScript<Field[]>(readFieldsScript);
}

/** Sets select and textarea values by their field index. */
export async function fillFields(driver: WebDriver, updates: FieldUpdate[]): Promise<void> {
  await driver.executeScript(fillFieldsScript, updates);
}

/** Clicks the first button or label whose text contains the given phrase. */
export async function clickText(driver: WebDriver, phrase: string): Promise<boolean> {
  return driver.executeScript<boolean>(clickTextScript, phrase);
}

/** True when the open page is a SEEK security check rather than results or an application. */
export async function isBotCheck(driver: WebDriver): Promise<boolean> {
  const script = "return (document.body && document.body.innerText || '').slice(0, 2000)";
  return isBotCheckText(await driver.executeScript<string>(script));
}

/** True when SEEK shows its generic failure banner on the apply form. */
export async function hasSeekError(driver: WebDriver): Promise<boolean> {
  const script = "return (document.body && document.body.innerText || '').includes('Something has gone wrong')";
  return driver.executeScript<boolean>(script);
}

/** Returns a short slice of the visible page text. */
export async function pageText(driver: WebDriver): Promise<string> {
  return driver.executeScript<string>("return (document.body && document.body.innerText || '').slice(0, 800)");
}

const readFieldsScript = `return (() => {
  function questionFor(el) {
    let node = el.parentElement;
    for (let i = 0; i < 8 && node; i += 1) {
      const labels = [...node.querySelectorAll("label,legend,p,h2,h3")].filter(
        (label) => !el.contains(label) && label.innerText && label.innerText.trim().length > 8
      );
      if (labels.length) return labels[0].innerText.trim();
      node = node.parentElement;
    }
    return el.getAttribute("aria-label") || "";
  }
  const selects = [...document.querySelectorAll("select")].map((select) => ({
    kind: "select",
    question: questionFor(select),
    options: [...select.options].map((option) => option.text.trim()).filter(Boolean),
    required: !select.value,
    filled: Boolean(select.value)
  }));
  const areas = [...document.querySelectorAll("textarea")].map((area) => ({
    kind: "textarea",
    question: questionFor(area),
    options: [],
    required: area.required || area.getAttribute("aria-required") === "true",
    filled: Boolean(area.value.trim())
  }));
  return selects.concat(areas);
})()`;

const fillFieldsScript = `const updates = arguments[0];
function setNativeValue(element, value) {
  const prototype = element instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
  setter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
const fields = [...document.querySelectorAll("select, textarea")];
for (const update of updates) {
  const field = fields[update.index];
  if (!field) continue;
  if (field instanceof HTMLSelectElement) {
    const option = [...field.options].find((item) => item.text.trim() === update.value);
    if (option) setNativeValue(field, option.value);
  } else {
    setNativeValue(field, update.value);
  }
}`;

const clickTextScript = `const phrase = arguments[0].toLowerCase();
const target = [...document.querySelectorAll("button,label")].find((el) =>
  (el.innerText || "").toLowerCase().includes(phrase)
);
if (target) target.click();
return Boolean(target);`;
