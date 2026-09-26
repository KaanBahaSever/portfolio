/**
 * Geometry of the globe figure, shared by the server-rendered SVG (GeoDistance.astro) and the
 * browser redraws (globe-view.ts), so the first frame and every later one match exactly.
 */
import type { GlobeOptions } from '../../../lib/geo/globe.ts';

/** The disc is centred on (0, 0); the view box leaves room for the A and B letters at the limb. */
export const GLOBE: Readonly<Required<GlobeOptions>> = {
  radius: 148,
  graticuleStep: 15,
  sampleStep: 5,
  decimals: 1,
};

export const GLOBE_VIEW_BOX = '-162 -162 324 324';
