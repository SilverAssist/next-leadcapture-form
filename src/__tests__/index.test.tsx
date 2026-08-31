import { act, render, waitFor } from "@testing-library/react";

import LeadCaptureForm, { leadCaptureLoader } from "../index";

const formTokens = { desktop: "GLFT-DESKTOP", mobile: "GLFT-MOBILE" };

describe("LeadCaptureForm", () => {
  afterEach(() => {
    leadCaptureLoader.reset();
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
    const loadSpy = jest.spyOn(leadCaptureLoader, "load");

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
    const loadSpy = jest.spyOn(leadCaptureLoader, "load");

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
    const loadSpy = jest.spyOn(leadCaptureLoader, "load");

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
    const releaseSpy = jest.spyOn(leadCaptureLoader, "releaseOwnership");

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
    const unloadSpy = jest.spyOn(leadCaptureLoader, "unload");

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

  it("does not unload on modal unmount", () => {
    jest.useFakeTimers();
    const unloadSpy = jest.spyOn(leadCaptureLoader, "unload");

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
});
