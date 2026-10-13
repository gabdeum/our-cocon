---
name: add-component
description: Create a UI component that the design system doesn't have yet, following design/system/Extending.md.
---
1. Confirm no existing `packages/ui` component or variant covers the need (check `design/system/components/`).
2. Follow `design/system/Extending.md`: tokens only, the closest existing component's states and sizes, 44 px targets, a screen-reader label.
3. Add it to `packages/ui` with its variants and states, plus a gallery entry at `/dev/gallery`.
4. Add `design/system/components/<Name>/README.md` in the same format as the others.
5. Tell me the component's name and why it was needed (in the PR and in your reply).
