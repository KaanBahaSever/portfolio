/**
 * Status badges for a project's lifecycle stage (the `stage` field of the projects schema).
 *
 * Pure module (no `astro:*` imports, erasable TypeScript) so `node --test` can load it.
 */

/** Mirrors the `stage` enum in src/content.config.ts (kept here so this module stays pure). */
export type ProjectStage = 'production' | 'early-access' | 'in-development';

/**
 * One status badge. 'in-development' and 'early-access' use the shared common.badges labels;
 * 'production' uses projects.stage.production.
 */
export type StageBadge = 'production' | 'in-development' | 'early-access';

/**
 * The badges for a stage, in reading order.
 *
 * Early access is a phase of development, not an alternative to it: the software is still
 * being built and people can already try it. Showing only "Early access" hid the first half,
 * so that stage shows both ("In development", "Early access"), the way the brief states
 * Asion's status.
 */
export function stageBadges(stage: ProjectStage | undefined): readonly StageBadge[] {
  switch (stage) {
    case 'production':
      return ['production'];
    case 'early-access':
      return ['in-development', 'early-access'];
    case 'in-development':
      return ['in-development'];
    default:
      return [];
  }
}
