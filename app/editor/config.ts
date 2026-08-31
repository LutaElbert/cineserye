/**
 * Product-level values that a derived application is expected to change.
 *
 * Keep domain behavior out of this file. New node types, inspector controls,
 * and agent commands belong in their own modules so upgrades from this starter
 * stay reviewable.
 */
export const APP_CONFIG = {
  name: 'Cineserye',
  shortMark: 'C',
  description: 'A local-first, agent-ready cinema workspace for developing stories scene by scene and shot by shot.',
  editorAriaLabel: 'Cineserye story canvas editor',
  storage: {
    databaseName: 'cineserye-local',
    projectFormat: 'cineserye-project',
    projectExtension: '.cineserye',
  },
  export: {
    defaultFileBase: 'cineserye-story',
    svgTitle: 'Cineserye editable story canvas',
    svgDescription: 'An editable story, scene, and shot canvas exported from Cineserye.',
  },
  vectorization: {
    workerName: 'cineserye-vectorizer',
  },
} as const;
