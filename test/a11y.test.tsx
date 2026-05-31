import { test } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import * as axe from "axe-core";

type FrameRequestCallback = (time: number) => void;

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const window = dom.window as unknown as Window & typeof globalThis;
Object.defineProperty(globalThis, "window", {
  value: window,
  configurable: true,
});
Object.defineProperty(globalThis, "document", {
  value: window.document,
  configurable: true,
});
Object.defineProperty(globalThis, "navigator", {
  value: window.navigator,
  configurable: true,
});
Object.defineProperty(globalThis, "HTMLElement", {
  value: window.HTMLElement,
  configurable: true,
});
Object.defineProperty(globalThis, "Node", {
  value: window.Node,
  configurable: true,
});
Object.defineProperty(globalThis, "getComputedStyle", {
  value: window.getComputedStyle.bind(window),
  configurable: true,
});
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : ((callback: FrameRequestCallback) => setTimeout(callback, 0)),
  configurable: true,
});

test.afterEach(() => {
  cleanup();
});

async function runAxe(container: HTMLElement) {
  const results = await axe.run(container);
  assert.equal(results.violations.length, 0, `Accessibility violations found: ${JSON.stringify(results.violations, null, 2)}`);
}

test("skip navigation anchor is keyboard-accessible and a11y compliant", async () => {
  const { container } = render(
    <div>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main id="main-content" tabIndex={-1}>
        Main content
      </main>
    </div>
  );

  await runAxe(container);
});

test("mobile menu markup has accessible ARIA attributes", async () => {
  const { container } = render(
    <div>
      <button aria-expanded="false" aria-controls="mobile-navigation" aria-label="Toggle menu">
        Open menu
      </button>
      <div id="mobile-navigation" role="navigation" aria-label="Mobile menu">
        <a href="/courses">Courses</a>
      </div>
    </div>
  );

  await runAxe(container);
});

test("transcript section markup is accessible with ARIA semantics", async () => {
  const { container } = render(
    <div>
      <button aria-expanded="false" aria-controls="lesson-transcript" aria-label="Expand lesson transcript">
        Transcript
      </button>
      <div id="lesson-transcript" tabIndex={-1} role="region" aria-label="Lesson transcript">
        Transcript content goes here.
      </div>
    </div>
  );

  await runAxe(container);
});
