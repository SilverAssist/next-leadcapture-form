# Changelog

All notable changes to this project will be documented in this file.

## [0.1.1] - Unreleased

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
