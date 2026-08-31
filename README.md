# @silverassist/leadcapture-form

LeadCapture IO form integration for Next.js apps. Variant switching,
ownership arbitration between competing components (e.g. a modal and an
on-page form), and ref-counted script lifecycle — built on
`@silverassist/next-script-loader`.

## Status

Extracted from the fleet's `ScriptManager` implementations — the pattern
`@silverassist/next-script-loader` itself was generalized from (see that
package's own doc comment). Not yet published. Part of the fleet-wide
third-party-integration package effort described in
`nextjs-boilerplate/docs/NEXTJS_CORE_PACKAGE_PLAN.md`.

**Known behavioral difference from the site implementations this was ported
from:** the shared `leadCaptureLoader` tracks one active variant at a time —
loading a different variant tears down the previous one, the same way
`ScriptLoader.load()` always has. The original per-site `ScriptManager`
tracked state per variant independently, so two different variants could in
principle stay loaded simultaneously (e.g. a modal on `"desktop"` and an
on-page form on `"mobile"` on the same page at once). If your site actually
needs that, instantiate a second `ScriptLoader` yourself rather than sharing
`leadCaptureLoader` — see [Advanced: two independent
loaders](#advanced-two-independent-loaders).

LeadCapture IO serves one shared script for every variant — it reads which
form to render from a global `window.form_token` this component sets from
`formTokens[formVariant]` right before loading, rather than varying the
script URL per variant.

## Install

```bash
npm install @silverassist/leadcapture-form
```

## Usage

```tsx
import LeadCaptureForm from "@silverassist/leadcapture-form";

const FORM_TOKENS = { desktop: "GLFT-XXXX", mobile: "GLFT-YYYY" };

// Modal usage
<LeadCaptureForm
  formVariant="desktop"
  formTokens={FORM_TOKENS}
  usageContext="modal"
  isModalOpen={isOpen}
/>;

// On-page usage
<LeadCaptureForm
  formVariant="mobile"
  formTokens={FORM_TOKENS}
  usageContext="onPage"
  isModalOpen={true}
/>;
```

A single form can render in multiple DOM locations via the
`.leadforms-embd-form` class inside the component's container — LeadCapture
IO's script populates every matching div once it loads, it doesn't re-run
per div.

### Props

| Prop            | Type                     | Default                          | Description                                                                                |
| --------------- | ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------ |
| `formVariant`   | `string`                 | —                                | Required. Must match a key in `formTokens` (e.g. `"desktop"`, `"itt"`).                    |
| `formTokens`    | `Record<string, string>` | —                                | Required. Maps variant names to LeadCapture IO form tokens.                                |
| `scriptUrl`     | `string`                 | LeadCapture IO's default CDN URL | Override the embed script URL.                                                             |
| `usageContext`  | `"modal" \| "onPage"`    | —                                | Required. Controls when the script loads.                                                  |
| `isModalOpen`   | `boolean`                | —                                | Required. Only meaningful for `usageContext="modal"`.                                      |
| `className`     | `string`                 | `""`                             | CSS classes on the container.                                                              |
| `embedTargetId` | `string`                 | —                                | Id for the inner `.leadforms-embd-form` div (e.g. matching a WordPress `embed_target_id`). |

## Advanced: two independent loaders

If a page genuinely needs two different variants active at once, don't rely
on the module-level `leadCaptureLoader` singleton for both — the underlying
`@silverassist/next-script-loader` `ScriptLoader` only tracks one variant per
instance. Fork this component (or file an issue) rather than sharing the
export across two forms that need independent variants simultaneously; this
is a real gap, not a documented-and-solved case, in v0.1.0.

## License

[PolyForm Noncommercial 1.0.0](./LICENSE)

---

Made with ❤️ by Silver Assist
