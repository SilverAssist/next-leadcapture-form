# @silverassist/leadcapture-form

LeadCapture IO form integration for Next.js apps. Variant switching,
ownership arbitration between competing components (e.g. a modal and an
on-page form), and ref-counted script lifecycle — built on
`@silverassist/next-script-loader`.

## Status

Extracted from the fleet's `ScriptManager` implementations — the pattern
`@silverassist/next-script-loader` itself was generalized from (see that
package's own doc comment). Published on npm. Part of the fleet-wide
third-party-integration package effort described in
`nextjs-boilerplate/docs/NEXTJS_CORE_PACKAGE_PLAN.md`.

Each form variant gets its own independent script lifecycle — a modal on
`"desktop"` and an on-page form on `"mobile"` can be loaded at the same time
without either tearing the other down, matching the fleet's original
per-site `ScriptManager`. Two `LeadCaptureForm`s for the _same_ variant
still share one script (ref-counted — it's only removed once the last one
unmounts).

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

## License

[PolyForm Noncommercial 1.0.0](./LICENSE)

---

Made with ❤️ by Silver Assist
