import puppeteer from "puppeteer";
import locations from "./locations.json" assert { type: "json" };
import { spawn } from "child_process";

// regex for DevTools listening on ws://127.0.0.1:9222/devtools/browser/64e21d33-4771-4a66-9053-426b594253ce
const REGEX = /DevTools listening on (ws:\/\/.*)/;

const chromeProcess = spawn(
  "/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222",
  {
    shell: true,
  }
);

chromeProcess.stderr.on("data", (data) => {
  console.log(data.toString());
  const match = REGEX.exec(data.toString());
  if (match) {
    main(match[1]).catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
});

async function main(address) {
  const browser = await puppeteer.connect({
    browserWSEndpoint: address,
  });
  const page = await browser.newPage();
  const total = Object.keys(locations).length;
  let current = 0;
  const summary = {
    cantSave: [],
    cantAddNote: [],
  };
  for (const [url, description] of Object.entries(locations)) {
    current++;
    console.log(`[${current}/${total}] ${url}`);
    await page.goto(url);
    try {
      await clickByText(page, "Save");
    } catch (error) {
      console.warn("Couldn't save, skipping");
      summary.cantSave.push(url);
      continue;
    }
    await clickByText(page, "France w Mom 23");
    try {
      await clickByText(page, "Add note");
      await page.waitForSelector("textarea");
      await page.type("textarea", description);
      await clickByText(page, "Done");
    } catch (error) {
      console.warn("Couldn't add note, skipping");
      summary.cantAddNote.push(url);
    }
    await sleep(100);
  }
  console.log("Summary:");
  console.log(summary);
  await browser.close();
}

function sleep(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

async function findElementByText(page, text, timeout = 200) {
  let tries = 0;
  let element;
  while (tries * 10 < timeout) {
    tries++;
    [element] = await page.$x(
      `//div[@id='app-container']//*[text()='${text}'][1]`
    );
    if (element) {
      return element;
    }
    await sleep(10);
  }
  return null;
}

async function clickByText(page, text, timeout = 200) {
  const element = await findElementByText(page, text, timeout);
  if (!element) {
    throw new Error(`Element with text "${text}" not found`);
  }
  return await element.click();
}
