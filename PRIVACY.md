# Privacy Policy for Split View

**Last Updated:** February 10, 2026

## Data Collection
Split View ("the Extension") **does not collect, transmit, or store any user data on remote servers.**

## Local Storage
The Extension uses your browser's local storage API (`chrome.storage.local`) solely to:
1. Save UI preferences (Dark Mode and Navigation Bar visibility).
2. Save current split URLs.
3. Save named layouts created by the user (layout name, URLs, pane count, and layout geometry).
4. Store temporary tab-scoped split state to support accurate save/load behavior.

This data stays on your device and is never sent to us or any third party.

## Permission Usage
* **Host Permissions (`<all_urls>`):** Required so users can open any site in split panes.
* **Tabs:** Used to read currently open tabs when launching split layouts and to manage split tab state.
* **DeclarativeNetRequest:** Used to modify frame-related response headers so sites can render in pane iframes.

## Contact
If you have any questions about this policy, please open an issue on our GitHub repository.
