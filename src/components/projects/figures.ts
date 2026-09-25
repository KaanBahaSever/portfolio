/**
 * Projects that have a line drawing (ProjectFigure.astro). The ids are the keys of the caption
 * catalogue, so a drawing without a caption (or the reverse) is a type error.
 */
import { projectsMessages, type ProjectsMessages } from '../../i18n/messages/projects.ts';

export type FigureId = keyof ProjectsMessages['figures'];

export function hasFigure(id: string): id is FigureId {
  return Object.hasOwn(projectsMessages.en.figures, id);
}
