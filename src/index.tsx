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
 * Module-level singleton: every `LeadCaptureForm` instance on the page
 * shares one loader. `ScriptLoader` tracks a single active variant at a
 * time — switching variants tears down the previous one — which matches
 * how this form is actually used in the fleet (one device/territory
 * variant active per page). A page that genuinely needs two different
 * variants loaded simultaneously (e.g. a modal on "desktop" and an on-page
 * form on "mobile" at once) isn't supported by this shared instance; see
 * the README for the workaround.
 */
export const leadCaptureLoader = new ScriptLoader();

/**
 * Generation counter per variant, incremented on every {@link ScriptLoader.load}/
 * {@link ScriptLoader.reload} call. A delayed on-unmount cleanup captures the
 * generation at mount time and skips its `unload()` call if the generation has
 * since advanced — i.e. a new mount already reloaded the script before the old
 * mount's delayed cleanup ran (a page-navigation remount, not a real teardown).
 * `ScriptLoader`'s own ref-counting handles the common case; this guards the
 * one case it doesn't: `reload()` doesn't change the reference count, so a
 * stale `unload()` after a `reload()` could drop the count to zero and tear
 * down a script a fresh mount is now depending on.
 */
const generationByVariant = new Map<string, number>();

function bumpGeneration(variant: string): number {
  const next = (generationByVariant.get(variant) ?? 0) + 1;
  generationByVariant.set(variant, next);
  return next;
}

function currentGeneration(variant: string): number {
  return generationByVariant.get(variant) ?? 0;
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
  const hasHandledRemountRef = useRef(false);
  const containerId = `leadcapture-container-${formVariant}-${usageContext}`;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    leadCaptureLoader.configure({
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

      bumpGeneration(formVariant);
      leadCaptureLoader
        .load(formVariant)
        .then(() => {
          if (!isMountedRef.current) return;
          leadCaptureLoader.forceSetOwner(containerId);
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
   * Guarded by `hasHandledRemountRef` so this can only ever act once per
   * real component instance: `reload()` tears down and recreates the
   * `<script>` element, and removing a `<script>` doesn't reliably cancel
   * its in-flight network request, so calling it twice in a row for the
   * same mount (e.g. React Strict Mode's dev-only effect-cleanup-effect
   * replay, which reuses this same ref) can let both the superseded and
   * the current script execute and each populate the container, rendering
   * the widget twice. Claiming ownership isn't a substitute for this guard
   * -- `setOwner` is idempotent for the same id, so a second call from the
   * same instance succeeds too.
   */
  useEffect(() => {
    if (usageContext !== "onPage") return;
    if (hasHandledRemountRef.current) return;
    if (currentGeneration(formVariant) === 0) return;
    if (!leadCaptureLoader.setOwner(containerId)) return;

    const container = formRef.current?.querySelector(".leadforms-embd-form");
    if (!container || container.children.length > 0) return;

    hasHandledRemountRef.current = true;
    (window as Window & { form_token?: string }).form_token = formTokens[formVariant];
    bumpGeneration(formVariant);
    leadCaptureLoader
      .reload(formVariant)
      .then(() => {
        if (!isMountedRef.current) return;
        leadCaptureLoader.forceSetOwner(containerId);
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
    mountGenRef.current = currentGeneration(formVariant);
  }, [formVariant]);

  /**
   * Cleanup on unmount only.
   * Modal: only releases ownership, doesn't unload the script.
   * OnPage: releases ownership and unloads after a short delay, skipped if
   * a newer mount has already reloaded the script in the meantime.
   */
  useEffect(() => {
    return () => {
      leadCaptureLoader.releaseOwnership(containerId);

      if (usageContext === "onPage") {
        const gen = mountGenRef.current;
        setTimeout(() => {
          if (gen < currentGeneration(formVariant)) return;
          leadCaptureLoader.unload();
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
