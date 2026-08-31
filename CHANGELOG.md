# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - Unreleased

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
