# Canvas Starter privacy baseline

Canvas Starter processes imported images and editable canvas documents on the user's device. Image vectorization is disabled in the default interface.

## Data handling

- Imported images, editable paths, names, and canvas state are saved in that browser's IndexedDB.
- The starter does not upload images or document contents to a server or AI provider.
- Project backups and SVG exports are created only after the user requests a download.
- Clearing browser site data removes the locally saved project for that origin. A downloaded backup is the recovery mechanism.

## Hosting metadata

The hosting provider may process standard HTTP request metadata needed to deliver the application, such as IP address, user agent, requested URL, timing, and error status. Application logs must never include imported images, SVG path data, project names, or document contents.

## Before adding cloud or AI features

A derived app must document each provider, what data leaves the browser, why it is sent, retention and deletion behavior, user controls, and cost limits. Add explicit consent before the first transfer and provide a way to cancel agent work.

This document is a technical baseline, not a complete privacy policy for a derived product.
