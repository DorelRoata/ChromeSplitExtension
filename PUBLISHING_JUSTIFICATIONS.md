# Chrome Web Store Publishing Justifications

Use the texts below to fill out the "Privacy practices" tab in the Developer Dashboard.

## 1. Single Purpose Description
**Description:**
To allow users to view and interact with multiple websites simultaneously within a single browser tab using a configurable split-screen grid.

## 2. Permission Justifications

### declarativeNetRequest
**Justification:**
This permission is critical for the extension's core functionality of displaying third-party websites within iframes. Many websites send `X-Frame-Options` or `Content-Security-Policy` headers that block them from being embedded. We use `declarativeNetRequest` solely to strip these specific headers from the sites the user chooses to view, allowing them to render correctly inside the split-view grid. We do not modify network requests for any other purpose.

### Host Permissions (`<all_urls>`)
**Justification:**
The extension allows users to load *any* website into the split-view grid. To ensure these websites can be displayed (see `declarativeNetRequest` above), the extension must have permission to interact with requests from any origin to remove frame-blocking headers. Without `<all_urls>`, users would encounter broken or blank pages for most sites they attempt to view. The extension does not read or collect page content.

### Storage
**Justification:**
Storage is used strictly to save the user's local preferences (Dark Mode toggle, Navigation Bar visibility) and to temporarily remember the URLs of the websites currently displayed in the grid so they can be restored if the tab is reloaded or reopened. All data is stored locally on the device.

### Tabs
**Justification:**
The "tabs" permission is required for the "Launch from Open Tabs" feature. When the user clicks the extension button, it reads the URLs of their currently open tabs to automatically populate the split-view grid. This provides a seamless transition from individual tabs to a unified multivalue view.

### Remote Code Use
**Answer:**
No, this extension does not use remote code. All logic is contained within the extension package.

## 3. Data Usage Certification
**Action:**
Check the box confirming: "I certify that the collection and usage of data by this extension complies with the Developer Program Policies."
