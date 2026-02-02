# Privacy Policy for Split View

**Last Updated:** February 2, 2026

## Data Collection
Split View ("the Extension") **does not collect, transmit, or store any user data on remote servers.**

## Local Storage
The Extension uses your browser's local storage API (`chrome.storage.local`) solely to:
1.  Save the URLs of the tabs you are currently viewing so they can be displayed in the split grid.
2.  Remember your preference for "Dark Mode" and "Navigation Bars".

This data stays on your device and is never sent to us or any third party.

## Permission Usage
*   **Host Permissions (`<all_urls>`):** This permission is strictly required to allow the Extension to display *any* website you choose within the split-view grid logic (specifically, to bypass `X-Frame-Options` headers locally so the site can be viewed). We do not read or modify the content of pages for any other purpose.
*   **Tabs:** Used to read your currently open tabs to populate the grid.
*   **DeclarativeNetRequest:** Used to strip frame-protection headers locally to ensure websites render correctly inside the split view.

## Contact
If you have any questions about this policy, please open an issue on our GitHub repository.
