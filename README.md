# Split View for Chrome

Split View lets you run multiple websites inside a single Chrome tab.

## Core Features
- Dual view (2 panes), quad view (4 panes), and custom layouts (1-16 panes).
- Drag-resize grid splitters.
- Per-pane navigation controls (back, reload, URL bar).
- Two close behaviors:
  - Close and compact horizontally.
  - Close and compact vertically.
- Save named layouts and reload them later.
- Dark mode and optional nav bar visibility.

## Popup Controls
- `Quad View (4)`: opens a 4-pane split view.
- `Dual View (2)`: opens a 2-pane split view.
- `Custom panes (1-16)` + `Launch Custom Split`: opens a split view with the requested pane count.
- `Reset Split Sizes`: resets splitter sizes for the active split tab.
- `Show Nav Bar`: toggles pane nav bars on/off.
- `Dark Mode`: toggles dark/light appearance.
- `Layout name`: optional name used when saving.
- `Save Current Layout`: saves current split URLs + layout geometry.
- `Load Selected Layout`: launches a saved layout.
- `Delete Selected Layout`: removes a saved layout.

## In-Grid Pane Controls
- `Back`: navigates pane history backward.
- `Reload`: reloads pane URL.
- `Address bar`: enter URL or search query (press Enter).
- `Close pane (horizontal)`: closes pane and compacts with row-aligned panes.
- `Close pane (vertical)`: closes pane and compacts with column-aligned panes.

## Keyboard Shortcuts
- `Alt+S`: launch quad view.
- `Alt+D`: launch dual view.
- `Alt+H`: toggle nav bar visibility.


## Compatibility + Security Considerations (Important)
With iframe sandbox now including `allow-same-origin`, more websites can complete login/session flows because
cookies and `localStorage` are available inside panes.

Please validate these cases before release:
- Login flows that use redirects and popup windows (Google, Microsoft, Shopify admin, etc.).
- Sites that depend on third-party cookies (Chrome cookie policy can still block these regardless of extension logic).
- Checkout/payment flows that may intentionally block embedding or use anti-clickjacking checks.

Known limitations that can still occur:
- Some sites will still refuse to function when framed due to runtime frame-busting logic.
- Server-side CORS policies still apply for requests made by framed page scripts.
- OAuth providers may require a top-level tab for final callback completion.

Risk tradeoff:
- `allow-same-origin` improves compatibility, but it lowers iframe isolation compared with a stricter sandbox.
- Keep `allow-top-navigation` disabled to reduce risk of framed pages navigating the split-view tab unexpectedly.
- Re-test any declarativeNetRequest header modifications whenever Chrome or target sites change behavior.

Recommended release checklist:
1. Verify login/logout on at least 5 representative modern sites.
2. Verify address bar navigation, back, and reload still behave correctly after authentication.
3. Verify popup-based auth closes cleanly and session remains in pane.
4. Verify no unexpected navigation of the top extension tab.
5. Monitor console for recurring `SecurityError`, CORS, or React hydration/runtime failures.

## Data Stored Locally
- UI preferences: dark mode, nav visibility.
- Current split URLs.
- Saved layouts (name, URLs, pane count, geometry).
- Temporary tab-scoped split state for accurate save/restore.

No remote servers are used for storage by this extension.

## Chrome Web Store Readiness Notes
- Single purpose: split-view multitasking.
- Remote hosted code: not used.
- Permissions are high-scope (`<all_urls>`, `declarativeNetRequest`) and require strong review justification.
- Frame-header removal (`X-Frame-Options` and `Content-Security-Policy`) is sensitive and may trigger manual review scrutiny.
