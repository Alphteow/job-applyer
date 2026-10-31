import { spawn } from "node:child_process";
import { Builder, Browser, type WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;

/** Arguments for a normal Chrome window Google will allow a sign-in on. */
export function chromeLaunchArgs(profileDir: string, port: number): string[] {
  return [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--start-maximized",
    "https://au.seek.com/",
  ];
}

/** Starts normal Chrome, waits until SEEK is signed in, then lets Selenium attach. */
export async function launchSignedInChrome(profileDir: string): Promise<WebDriver> {
  if (!(await debuggerIsUp(PORT))) {
    spawn(CHROME, chromeLaunchArgs(profileDir, PORT), { detached: true, stdio: "ignore" }).unref();
    await waitForDebugger(PORT);
  }
  await waitUntilSignedIn(PORT);
  return attachDriver(PORT);
}

async function debuggerIsUp(port: number): Promise<boolean> {
  try {
    return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
  } catch {
    return false;
  }
}

async function waitForDebugger(port: number): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      await delay(300);
    }
  }
  throw new Error("Chrome did not open. Close other Chrome windows using this profile and try again.");
}

async function waitUntilSignedIn(port: number): Promise<void> {
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    if (!(await seekShowsSignIn(port))) {
      return;
    }
    console.log("Sign in to SEEK in the Chrome window. Waiting...");
    await delay(3000);
  }
  throw new Error("SEEK is still signed out. Sign in, then run npm run apply again.");
}

async function seekShowsSignIn(port: number): Promise<boolean> {
  const tabs = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as DebugTab[];
  const page = tabs.find((tab) => tab.type === "page" && tab.webSocketDebuggerUrl);
  if (!page?.webSocketDebuggerUrl) {
    return true;
  }
  if (/login\.seek\.com|accounts\.google\.com/.test(page.url ?? "")) {
    return true;
  }
  const expression = `[...document.querySelectorAll('a')].some(a => (a.innerText || '').trim() === 'Sign in')`;
  return evaluate(page.webSocketDebuggerUrl, expression);
}

function attachDriver(port: number): Promise<WebDriver> {
  const options = new chrome.Options();
  options.debuggerAddress(`127.0.0.1:${port}`);
  return new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
}

function evaluate(wsUrl: string, expression: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Could not read the SEEK page"));
    }, 5000);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
    });
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: { result?: { value?: boolean } } };
      if (message.id !== 1) {
        return;
      }
      clearTimeout(timer);
      ws.close();
      resolve(Boolean(message.result?.result?.value));
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("Could not connect to Chrome"));
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DebugTab {
  type: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}
