# Chrome Web Store Publishing Justifications

Use the texts below to fill out the "Privacy practices" tab in the Developer Dashboard.

## 1. Single Purpose Description
**Description:**
To let users view and interact with multiple websites simultaneously inside one browser tab, using configurable split layouts and pane controls.

## 2. Permission Justifications

### declarativeNetRequest
**Justification:**
This permission is used for the extension's core split-pane embedding feature. Many websites send `X-Frame-Options` or `Content-Security-Policy` headers that prevent iframe rendering. We use `declarativeNetRequest` only to modify these frame-blocking response headers for subframe rendering in split panes. We do not use this permission for ad-blocking, tracking, or unrelated request manipulation.

### Host Permissions (`<all_urls>`)
**Justification:**
The extension allows users to open any site in split panes. `<all_urls>` is required because users can enter arbitrary URLs, and frame-header modifications need broad host scope to work consistently. The extension does not harvest page content for analytics or resale.

### Storage
**Justification:**
Storage is used only for local functionality:
- UI preferences (Dark Mode, Navigation Bar visibility)
- Current split URLs
- Saved user layouts (name, URLs, pane count, and layout geometry)
- Temporary tab-scoped split state for accurate save/load behavior
All data is stored locally on-device.

### Tabs
**Justification:**
The `tabs` permission is required for:
- Launching split layouts from currently open tabs
- Detecting the active split tab when applying actions like reset
- Maintaining split-tab state for save/load reliability

### Remote Code Use
**Answer:**
No, this extension does not use remote code. All logic is contained within the extension package.

## 3. Data Usage Certification
**Action:**
Check the box confirming: "I certify that the collection and usage of data by this extension complies with the Developer Program Policies."
