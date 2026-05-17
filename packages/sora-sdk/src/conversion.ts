import {
  findInstitutionRecord,
  INSTITUTION_BASELINE,
} from "./institutions.js";
import type {
  ContextualConversionResult,
  ManualGradeInput,
  InstitutionContextRecord,
} from "./types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeScore(input: ManualGradeInput): number {
  switch (input.gradingScale) {
    case "gpa4":
      return clamp((Number(input.gradeValue ?? 0) / 4) * 100, 0, 100);
    case "cgpa10":
      return clamp((Number(input.gradeValue ?? 0) / 10) * 100, 0, 100);
  }
}

function fallbackInstitution(input: ManualGradeInput): InstitutionContextRecord {
  return {
    institutionName: input.institutionName,
    country: input.country ?? "Unknown",
    gdi: INSTITUTION_BASELINE.gdi,
    si: INSTITUTION_BASELINE.si,
    gds: INSTITUTION_BASELINE.gds,
    arf: 0.5,
  };
}

function gradeBandFor(score: number): ContextualConversionResult["gradeBand"] {
  if (score >= 85) {
    return "distinction";
  }
  if (score >= 70) {
    return "merit";
  }
  if (score >= 55) {
    return "pass";
  }
  return "review";
}

function scaleLabel(scale: ManualGradeInput["gradingScale"]): string {
  switch (scale) {
    case "gpa4":
      return "4.0 GPA";
    case "cgpa10":
      return "10.0 CGPA";
  }
}

export function runContextualConversion(input: ManualGradeInput): ContextualConversionResult {
  const normalizedScore = Number(normalizeScore(input).toFixed(2));
  const institution = findInstitutionRecord(input.institutionName, input.country) ?? fallbackInstitution(input);
  const usedFallbackInstitution =
    findInstitutionRecord(input.institutionName, input.country) === undefined;

  const gdiFactor = clamp(institution.gdi / INSTITUTION_BASELINE.gdi, 0.8, 1.2);
  const siFactor = clamp(institution.si / INSTITUTION_BASELINE.si, 0.8, 1.2);
  const gdsFactor = clamp(INSTITUTION_BASELINE.gds / institution.gds, 0.8, 1.2);
  const arfFactor = clamp(institution.arf / INSTITUTION_BASELINE.arf, 0.8, 1.2);
  const contextFactor = Number(
    clamp(
      (0.35 * gdiFactor) + (0.30 * siFactor) + (0.15 * gdsFactor) + (0.20 * arfFactor),
      0.8,
      1.2,
    ).toFixed(3),
  );
  const convertedScore = Number(Math.min(100, normalizedScore * contextFactor).toFixed(2));

  return {
    normalizedScore,
    contextFactor,
    convertedScore,
    gradeBand: gradeBandFor(convertedScore),
    explanation: [
      `Normalized ${scaleLabel(input.gradingScale)} input into a base score of ${normalizedScore}.`,
      `Applied contextual factors for ${institution.institutionName}: GDI ${gdiFactor.toFixed(3)}, SI ${siFactor.toFixed(3)}, GDS ${gdsFactor.toFixed(3)}, ARF ${arfFactor.toFixed(3)}.`,
      usedFallbackInstitution
        ? "Institution was not found in the dataset, so a conservative fallback context was used."
        : "Institution was matched in the dataset and scored against the dataset baseline.",
      `Final contextual score is ${convertedScore} after applying a context factor of ${contextFactor}.`,
    ],
    institution,
    usedFallbackInstitution,
    factors: {
      gdiFactor: Number(gdiFactor.toFixed(3)),
      siFactor: Number(siFactor.toFixed(3)),
      gdsFactor: Number(gdsFactor.toFixed(3)),
      arfFactor: Number(arfFactor.toFixed(3)),
    },
  };
}
