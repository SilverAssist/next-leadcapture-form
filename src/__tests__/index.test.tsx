import { act, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";

import LeadCaptureForm, { getLoaderForVariant } from "../index";

const formTokens = { desktop: "GLFT-DESKTOP", mobile: "GLFT-MOBILE" };

describe("LeadCaptureForm", () => {
  afterEach(() => {
    // Every variant used anywhere in this file, not just "desktop"/"mobile"
    // -- each now has its own independent loader (that's the fix under
    // test), so a one-off variant's script element no longer gets torn
    // down as a side effect of some *other* variant loading later. Without
    // resetting it here explicitly, it would linger in document.head for
    // the rest of the suite and inflate script-count assertions in later
    // tests.
    ["desktop", "mobile", "remount", "strict", "never-loaded-before"].forEach((variant) =>
      getLoaderForVariant(variant).reset(),
    );
    jest.restoreAllMocks();
  });

  it("renders the embed container with the leadforms-embd-form target", () => {
    const { container } = render(
      <LeadCaptureForm
        formVariant="desktop"
        formTokens={formTokens}
        usageContext="modal"
        isModalOpen={false}
      />,
    );

    expect(container.querySelector(".leadforms-embd-form")).toBeInTheDocument();
  });

  it("applies the embedTargetId to the inner container", () => {
    const { container } = render(
      <LeadCaptureForm
        formVariant="desktop"
        formTokens={formTokens}
        usageContext="modal"
        isModalOpen={false}
        embedTargetId="provider-sidebar-leadcapture-form"
      />,
    );

    expect(container.querySelector("#provider-sidebar-leadcapture-form")).toBeInTheDocument();
  });

  it("loads the script when a modal opens", async () => {
    const loadSpy = jest.spyOn(getLoaderForVariant("desktop"), "load");

    render(
      <LeadCaptureForm
        formVariant="desktop"
        formTokens={formTokens}
        usageContext="modal"
        isModalOpen={true}
      />,
    );

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledWith("desktop");
    });
  });

  it("does not load until the modal opens", () => {
    const loadSpy = jest.spyOn(getLoaderForVariant("desktop"), "load");

    render(
      <LeadCaptureForm
        formVariant="desktop"
        formTokens={formTokens}
        usageContext="modal"
        isModalOpen={false}
      />,
    );

    expect(loadSpy).not.toHaveBeenCalled();
  });

  it("loads onPage forms once in viewport and interacted with", async () => {
    const loadSpy = jest.spyOn(getLoaderForVariant("mobile"), "load");

    render(
      <LeadCaptureForm
        formVariant="mobile"
        formTokens={formTokens}
        usageContext="onPage"
        isModalOpen={true}
      />,
    );

    // jest.setup.js's IntersectionObserver stub fires isIntersecting: true
    // synchronously on observe(), so the form is already "in viewport" --
    // only the interaction gate remains.
    act(() => {
      document.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledWith("mobile");
    });
  });

  it("releases ownership on unmount", () => {
    const releaseSpy = jest.spyOn(getLoaderForVariant("desktop"), "releaseOwnership");

    const { unmount } = render(
      <LeadCaptureForm
        formVariant="desktop"
        formTokens={formTokens}
        usageContext="modal"
        isModalOpen={true}
      />,
    );

    unmount();

    expect(releaseSpy).toHaveBeenCalledWith("leadcapture-container-desktop-modal");
  });

  it("schedules a delayed unload on onPage unmount", () => {
    jest.useFakeTimers();
    const unloadSpy = jest.spyOn(getLoaderForVariant("mobile"), "unload");

    const { unmount } = render(
      <LeadCaptureForm
        formVariant="mobile"
        formTokens={formTokens}
        usageContext="onPage"
        isModalOpen={true}
      />,
    );

    unmount();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    jest.useRealTimers();

    expect(unloadSpy).toHaveBeenCalled();
  });

  it("reloads the script to repopulate a fresh container after a navigation remount, without waiting for a new interaction", async () => {
    // Unique variant, its own dedicated loader instance (not reset by
    // afterEach, which only resets "desktop"/"mobile") -- avoids any
    // cross-test leakage on this variant's load history/generation.
    const remountTokens = { ...formTokens, remount: "GLFT-REMOUNT" };
    const loadSpy = jest.spyOn(getLoaderForVariant("remount"), "load");
    const reloadSpy = jest.spyOn(getLoaderForVariant("remount"), "reload");

    const pageA = render(
      <LeadCaptureForm
        formVariant="remount"
        formTokens={remountTokens}
        usageContext="onPage"
        isModalOpen={true}
      />,
    );

    // Page A: a real user interaction loads the script for the first time.
    act(() => {
      document.dispatchEvent(new Event("mousemove"));
    });

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledWith("remount");
    });

    // Simulate the vendor script populating page A's embed div once loaded.
    const embedA = pageA.container.querySelector(".leadforms-embd-form")!;
    embedA.appendChild(document.createElement("div"));

    // Navigate away: page A unmounts (its cleanup synchronously releases
    // ownership, matching how React unmounts the old tree before mounting
    // the new one on a client-side route change).
    pageA.unmount();

    // Page B: same variant/usageContext, so the same containerId -- a fresh,
    // empty container, with no interaction dispatched on it at all.
    const pageB = render(
      <LeadCaptureForm
        formVariant="remount"
        formTokens={remountTokens}
        usageContext="onPage"
        isModalOpen={true}
      />,
    );

    const embedB = pageB.container.querySelector(".leadforms-embd-form")!;
    expect(embedB.children.length).toBe(0);

    // The remount effect should reload on its own -- no interaction event
    // dispatched for page B.
    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledWith("remount");
    });

    expect(getLoaderForVariant("remount").owner).toBe("leadcapture-container-remount-onPage");

    pageB.unmount();
  });

  it("creates only one script element under React Strict Mode's dev-only effect replay on remount", async () => {
    // Unique variant, same reasoning as the remount test above.
    const strictTokens = { ...formTokens, strict: "GLFT-STRICT" };
    const loadSpy = jest.spyOn(getLoaderForVariant("strict"), "load");
    const reloadSpy = jest.spyOn(getLoaderForVariant("strict"), "reload");

    const pageA = render(
      <LeadCaptureForm
        formVariant="strict"
        formTokens={strictTokens}
        usageContext="onPage"
        isModalOpen={true}
      />,
    );

    act(() => {
      document.dispatchEvent(new Event("mousemove"));
    });

    await waitFor(() => {
      expect(loadSpy).toHaveBeenCalledWith("strict");
    });

    const embedA = pageA.container.querySelector(".leadforms-embd-form")!;
    embedA.appendChild(document.createElement("div"));

    pageA.unmount();

    // StrictMode double-invokes effects in dev (mount -> cleanup -> mount
    // again) on the same component instance, calling reload() twice for
    // the same variant before either has resolved. ScriptLoader.reload()
    // (0.1.1+) shares the in-flight promise for the second call instead of
    // tearing the script down again, so only one <script> element should
    // ever exist, regardless of how many times reload() itself was called.
    render(
      <StrictMode>
        <LeadCaptureForm
          formVariant="strict"
          formTokens={strictTokens}
          usageContext="onPage"
          isModalOpen={true}
        />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(reloadSpy).toHaveBeenCalledWith("strict");
    });

    expect(document.head.querySelectorAll("script")).toHaveLength(1);
  });

  it("does not reload on a genuinely first mount (no prior load history)", () => {
    const reloadSpy = jest.spyOn(getLoaderForVariant("never-loaded-before"), "reload");

    render(
      <LeadCaptureForm
        formVariant="never-loaded-before"
        formTokens={{ "never-loaded-before": "GLFT-FRESH" }}
        usageContext="onPage"
        isModalOpen={true}
      />,
    );

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it("does not unload on modal unmount", () => {
    jest.useFakeTimers();
    const unloadSpy = jest.spyOn(getLoaderForVariant("desktop"), "unload");

    const { unmount } = render(
      <LeadCaptureForm
        formVariant="desktop"
        formTokens={formTokens}
        usageContext="modal"
        isModalOpen={true}
      />,
    );

    unmount();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    jest.useRealTimers();

    expect(unloadSpy).not.toHaveBeenCalled();
  });

  // Regression: the original single shared `leadCaptureLoader` tracked one
  // active variant at a time -- loading a second, different variant tore
  // the first one's script down (ScriptLoader#ensureLoaded's `if
  // (this.#currentVariant !== variant) this.#teardownScript()`), unlike the
  // fleet's original per-site `ScriptManager`, which kept independent state
  // per variant in a `Map`. A page mounting a modal on one variant and an
  // on-page form on a different variant at the same time would silently
  // lose one of the two embeds. `getLoaderForVariant` gives each variant
  // its own `ScriptLoader` instance, restoring that independence.
  it("keeps two different variants loaded independently at the same time", async () => {
    const desktopLoadSpy = jest.spyOn(getLoaderForVariant("desktop"), "load");
    const mobileLoadSpy = jest.spyOn(getLoaderForVariant("mobile"), "load");

    render(
      <>
        <LeadCaptureForm
          formVariant="desktop"
          formTokens={formTokens}
          usageContext="modal"
          isModalOpen={true}
        />
        <LeadCaptureForm
          formVariant="mobile"
          formTokens={formTokens}
          usageContext="onPage"
          isModalOpen={true}
        />
      </>,
    );

    act(() => {
      document.dispatchEvent(new Event("mousemove"));
    });

    await waitFor(() => {
      expect(desktopLoadSpy).toHaveBeenCalledWith("desktop");
      expect(mobileLoadSpy).toHaveBeenCalledWith("mobile");
    });

    // Both script elements must still be in the DOM -- loading "mobile"
    // must not have torn down "desktop"'s script, and vice versa.
    expect(document.head.querySelectorAll("script")).toHaveLength(2);
  });
});
