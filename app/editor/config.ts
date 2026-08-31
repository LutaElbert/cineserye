/**
 * Product-level values that a derived application is expected to change.
 *
 * Keep domain behavior out of this file. New node types, inspector controls,
 * and agent commands belong in their own modules so upgrades from this starter
 * stay reviewable.
 */
export const APP_CONFIG = {
  name: 'Canvas Starter',
  shortMark: 'C',
  description: 'A local-first, extensible canvas for connected ideas, images, and editable layers.',
  editorAriaLabel: 'Canvas Starter diagram editor',
  storage: {
    databaseName: 'canvas-starter-local',
    projectFormat: 'canvas-starter-project',
    projectExtension: '.canvas',
  },
  export: {
    defaultFileBase: 'canvas-export',
    svgTitle: 'Canvas Starter editable diagram',
    svgDescription: 'An editable SVG exported from Canvas Starter.',
  },
  vectorization: {
    workerName: 'canvas-starter-vectorizer',
  },
} as const;
