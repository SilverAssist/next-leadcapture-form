# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4] - 2026-09-02

### Fixed

- **Two different form variants could no longer be loaded at the same
  time** — `leadCaptureLoader`, a single module-level `ScriptLoader`
  shared by every `LeadCaptureForm` instance regardless of variant, tears
  down whichever script is currently loaded when a _different_ variant
  calls `.load()`/`.reload()` (`ScriptLoader#ensureLoaded`'s
  `if (this.#currentVariant !== variant) this.#teardownScript()`). A page
  mounting a modal on one variant and an on-page form on a different
  variant at the same time silently lost one of the two embeds. The
  fleet's original per-site `ScriptManager` this package replaced kept
  independent state per variant in a `Map`, so two variants could stay
  loaded simultaneously without interfering — this was a real behavioral
  regression from that, documented in the README as a known gap since
  `0.1.0` rather than fixed. Replaced the single shared instance with
  `getLoaderForVariant(variant)`, a per-variant registry of `ScriptLoader`
  instances: multiple `LeadCaptureForm`s for the _same_ variant still
  share one loader (ref-counted, as before), but different variants each
  get their own and never tear each other down — restoring parity with
  the original `ScriptManager`. Not currently reachable in the fleet:
  `family-nextjs`, the only live consumer, deliberately renders exactly
  one variant at a time (`LeadFormProvider` picks `desktop`/`mobile` by
  device, gated so both never mount together) — this closes the gap for
  any future consumer that does need two variants at once, rather than
  fixing an observed production bug.

## [0.1.3] - 2026-08-31

### Changed

- Bumped `@silverassist/next-script-loader` to `^0.1.1` and removed the
  package-local generation map (`bumpGeneration`/`currentGeneration`) and
  the 0.1.2 `hasHandledRemountRef` guard, now that both are handled at the
  source: `ScriptLoader.reload()` itself shares the in-flight promise for
  a same-variant reload already in progress (the actual fix for the
  React Strict Mode double-render), and `ScriptLoader.getGeneration()` /
  `unload(atGeneration?)` replace the hand-rolled generation tracking this
  package carried since 0.1.0. No behavior change for consumers — same
  fix, now enforced one layer down so every `ScriptLoader` consumer gets
  it, not just this one.

## [0.1.2] - 2026-08-31

### Fixed

- The remount-detection effect added in 0.1.1 could reload the script
  twice for the same mount under React Strict Mode's dev-only
  effect-cleanup-effect replay (which reuses the same component instance
  and its refs) — `setOwner` is idempotent for the same container id, so
  it didn't block the second pass, and since removing a `<script>` doesn't
  reliably cancel its in-flight network request, both the superseded and
  the current script could execute and each populate the container,
  rendering the widget twice on a second page. Added a `hasHandledRemountRef`
  guard so the effect can only act once per real component instance.

## [0.1.1] - 2026-08-31

### Fixed

- `LeadCaptureForm` never repopulated the embed container after a
  client-side navigation to a second page also rendering the form. The
  vendor script only scans the DOM for `.leadforms-embd-form` divs once,
  when it first loads — it doesn't detect a div added by a later mount — so
  the widget silently stayed empty on any page after the first, waiting on
  a fresh minimal-interaction event that navigation itself never produces.
  Added a remount-detection effect (mirroring the fix already proven in
  `assistedliving-nextjs`'s local `ScriptManager`-based implementation)
  that reloads the script immediately when a variant has already loaded
  and its own container is still empty, bumping the generation counter on
  that reload so the existing stale-unmount guard (see 0.1.0) also
  protects this path — a delayed unmount cleanup left over from the page
  just navigated away from can no longer tear down a script the remount
  effect just reloaded.

## [0.1.0] - 2026-08-31

### Added

- Initial extraction of `LeadCaptureForm` from the fleet's `ScriptManager`
  implementations, ported onto `@silverassist/next-script-loader`.

### Changed

- The per-variant `ScriptManager` (independent state per variant) was
  replaced by `ScriptLoader`'s single-active-variant model. Ownership
  arbitration and ref-counted load/unload now come from `ScriptLoader`
  directly; only the generation-based stale-unmount guard (needed because
  `reload()` doesn't change the reference count) stays as package-local
  logic on top of it. See the README's "Known behavioral difference" note.
