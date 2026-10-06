import { infiniteCampus } from "./infiniteCampus";
import { otherSystem } from "./other";
import type { GradeSource } from "./types";

/**
 * Every school system the import understands, in dropdown order. A system with a dedicated parser (instant, free)
 * gets its own entry once there's a real paste to build it from; until then, "Other" (read by AI) covers it.
 */
export const GRADE_SOURCES: GradeSource[] = [infiniteCampus, otherSystem];
