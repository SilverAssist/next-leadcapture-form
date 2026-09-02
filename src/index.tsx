/**
 * @packageDocumentation
 * LeadCapture IO form integration for Next.js — a variant-switching,
 * ownership-arbitrated `LeadCaptureForm` component built on
 * `@silverassist/next-script-loader`.
 */

"use client";

import { ScriptLoader } from "@silverassist/next-script-loader";
import { useEffect, useRef, useState } from "react";

export type UsageContext = "modal" | "onPage";

/**
 * Module-level registry of loaders, one per form variant. `ScriptLoader`
 * itself tracks a single active variant at a time, so every
 * `LeadCaptureForm` instance for the SAME variant shares that variant's
 * loader (ref-counted, exactly one script element in the DOM regardless of
 * how many instances render it) — but two different variants (e.g. a modal
 * on "desktop" and an on-page form on "mobile") each get their own
 * independent loader and never tear each other down. Matches the fleet's
 * original per-site `ScriptManager`'s `Map<variant, state>` design, which
 * this replaced; see the CHANGELOG for the earlier single-shared-instance
 * version this restores parity with.
 */
const loaders = new Map<string, ScriptLoader>();

/**
 * Returns the {@link ScriptLoader} for `variant`, creating one on first
 * use. Exported for tests and for advanced callers that need direct access
 * to a specific variant's loader (e.g. to inspect {@link ScriptLoader.owner}
 * outside a `LeadCaptureForm` instance).
 */
export function getLoaderForVariant(variant: string): ScriptLoader {
  let loader = loaders.get(variant);
  if (!loader) {
    loader = new ScriptLoader();
    loaders.set(variant, loader);
  }
  return loader;
}

export interface LeadCaptureFormProps {
  /**
   * Form variant to render (e.g. "desktop", "mobile", "itt", "oot"). Must
   * match a key configured in `formTokens`.
   */
  formVariant: string;

  /** Map of variant names to LeadCapture IO form tokens. */
  formTokens: Record<string, string>;

  /** Script URL override, if not using LeadCapture IO's default CDN. */
  scriptUrl?: string;

  /**
   * Usage context — determines loading behavior.
   * - `modal`: loads when the modal opens
   * - `onPage`: loads when in viewport, after minimal interaction
   */
  usageContext: UsageContext;

  /** Controls whether the modal is open (only relevant for `usageContext="modal"`). */
  isModalOpen: boolean;

  /** Optional additional CSS classes. */
  className?: string;

  /**
   * Optional embed target id for the inner `.leadforms-embd-form` div. Must
   * match the WordPress `embed_target_id` when the site sources form
   * placement from WordPress.
   */
  embedTargetId?: string;
}

const DEFAULT_LEADCAPTURE_SCRIPT_URL = "https://api.useleadbot.com/lead-bots/get-pixel-script.js";

/**
 * LeadCaptureForm — renders a LeadCapture IO form with support for
 * configurable variants, built on `@silverassist/next-script-loader`'s
 * singleton, reference-counted, ownership-arbitrated script lifecycle.
 *
 * A single form can render in multiple DOM locations via the
 * `.leadforms-embd-form` class — LeadCapture IO's script populates every
 * matching div once it loads, it doesn't re-run per div.
 *
 * @example
 * ```tsx
 * // Modal usage
 * <LeadCaptureForm
 *   formVariant="desktop"
 *   formTokens={{ desktop: "GLFT-XXXX", mobile: "GLFT-YYYY" }}
 *   usageContext="modal"
 *   isModalOpen={isOpen}
 * />
 *
 * // On-page usage
 * <LeadCaptureForm
 *   formVariant="mobile"
 *   formTokens={{ desktop: "GLFT-XXXX", mobile: "GLFT-YYYY" }}
 *   usageContext="onPage"
 *   isModalOpen={true}
 * />
 * ```
 */
export default function LeadCaptureForm({
  formVariant,
  formTokens,
  scriptUrl,
  usageContext,
  isModalOpen,
  className = "",
  embedTargetId,
}: LeadCaptureFormProps) {
  const [isInViewport, setIsInViewport] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const mountGenRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const containerId = `leadcapture-container-${formVariant}-${usageContext}`;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    getLoaderForVariant(formVariant).configure({
      urls: { [formVariant]: scriptUrl ?? DEFAULT_LEADCAPTURE_SCRIPT_URL },
    });
  }, [formVariant, scriptUrl]);

  /**
   * Intersection Observer for onPage forms — loads when near viewport.
   */
  useEffect(() => {
    if (usageContext !== "onPage" || !formRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInViewport(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "100px", threshold: 0.1 },
    );

    observer.observe(formRef.current);
    return () => observer.disconnect();
  }, [usageContext]);

  /**
   * Script loading with minimal interaction pattern.
   * - Modal: loads immediately when the modal opens.
   * - OnPage: loads on the first of focus/mousemove/scroll/touchstart, once
   *   near viewport.
   */
  useEffect(() => {
    const shouldLoad = usageContext === "modal" ? isModalOpen === true : isInViewport;

    if (!shouldLoad) return;

    const load = () => {
      // LeadCapture IO serves one shared script for every variant and reads
      // which form to render from a global set just before the script
      // loads, rather than varying the script URL itself per variant.
      (window as Window & { form_token?: string }).form_token = formTokens[formVariant];

      getLoaderForVariant(formVariant)
        .load(formVariant)
        .then(() => {
          if (!isMountedRef.current) return;
          getLoaderForVariant(formVariant).forceSetOwner(containerId);
        })
        .catch(() => {
          // Silently degrade — the surrounding page stays usable without
          // the embed.
        });
    };

    if (usageContext === "modal") {
      load();
      return;
    }

    const events = ["focus", "mousemove", "scroll", "touchstart"] as const;
    const loadOnce = () => {
      load();
      events.forEach((event) => document.removeEventListener(event, loadOnce));
    };
    events.forEach((event) => {
      document.addEventListener(event, loadOnce, { once: true });
    });

    return () => {
      events.forEach((event) => document.removeEventListener(event, loadOnce));
    };
  }, [isModalOpen, isInViewport, formVariant, usageContext, containerId, formTokens]);

  /**
   * Handles a client-side navigation remount. The vendor script only scans
   * the DOM for `.leadforms-embd-form` divs once, when it first loads (see
   * the container comment below) -- it never repopulates a div added by a
   * later mount. Without this, a second page's form waits forever for a
   * *fresh* minimal-interaction event, which the click that triggered the
   * navigation doesn't itself produce (no new focus/mousemove/scroll/
   * touchstart fires on the new page unless the user moves again). Detect
   * that case immediately, using this variant's own load history instead
   * of the interaction gate above.
   *
   * Safe to call on every render this condition holds, including twice in
   * a row for the same mount under React Strict Mode's dev-only effect
   * replay: `ScriptLoader.reload()` (0.1.1+) shares the in-flight promise
   * for a same-variant reload already in progress instead of tearing the
   * script down again, so a second call here is a no-op rather than a
   * second script execution.
   */
  useEffect(() => {
    if (usageContext !== "onPage") return;
    const loader = getLoaderForVariant(formVariant);
    if (loader.getGeneration() === 0) return;
    if (!loader.setOwner(containerId)) return;

    const container = formRef.current?.querySelector(".leadforms-embd-form");
    if (!container || container.children.length > 0) return;

    (window as Window & { form_token?: string }).form_token = formTokens[formVariant];
    loader
      .reload(formVariant)
      .then(() => {
        if (!isMountedRef.current) return;
        loader.forceSetOwner(containerId);
      })
      .catch(() => {
        // Silently degrade -- the surrounding page stays usable without the embed.
      });
  }, [formVariant, containerId, usageContext]);

  /**
   * Capture the current generation at mount time — passed to the delayed
   * unload on cleanup so a stale unmount (superseded by a fresh mount that
   * already reloaded) is a no-op.
   */
  useEffect(() => {
    mountGenRef.current = getLoaderForVariant(formVariant).getGeneration();
  }, [formVariant]);

  /**
   * Cleanup on unmount only.
   * Modal: only releases ownership, doesn't unload the script.
   * OnPage: releases ownership and unloads after a short delay, skipped if
   * a newer mount has already reloaded the script in the meantime.
   */
  useEffect(() => {
    return () => {
      const loader = getLoaderForVariant(formVariant);
      loader.releaseOwnership(containerId);

      if (usageContext === "onPage") {
        const gen = mountGenRef.current;
        setTimeout(() => {
          loader.unload(gen);
        }, 100);
      }
    };
  }, []);

  return (
    <div ref={formRef} id={containerId} className={className}>
      {/*
        LeadCapture IO embed container.

        CRITICAL: this div must exist BEFORE the script loads -- LeadCapture IO
        only populates `.leadforms-embd-form` divs present at load time, it
        doesn't detect ones added later.
      */}
      <div className="leadforms-embd-form" {...(embedTargetId ? { id: embedTargetId } : {})}>
        {/* Form renders here */}
      </div>
    </div>
  );
}
