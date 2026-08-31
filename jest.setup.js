require("@testing-library/jest-dom");

// jsdom has no IntersectionObserver implementation. This stub fires
// `isIntersecting: true` synchronously on observe() -- tests that need to
// assert the *not yet in viewport* state should mock it themselves.
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      this.callback([{ isIntersecting: true, target }], this);
    }
    unobserve() {}
    disconnect() {}
  };
}
