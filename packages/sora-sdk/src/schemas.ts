import type { SupportedCredentialSchema } from "./types.js";

export const RUB_SCHEMAS: Record<
  SupportedCredentialSchema,
  {
    name: string;
    schemaUrl: string;
    attributes: string[];
  }
> = {
  studentId: {
    name: "Student ID",
    schemaUrl: "https://dev-schema.ngotag.com/schemas/295abb90-559d-401b-a100-8cb7a8ce5d2e",
    attributes: [
      "Student ID",
      "Student Name",
      "College Name",
      "Programme Name",
      "Enrollment Year",
      "Programme Duration",
    ],
  },
  academicCertificate: {
    name: "Academic Certificate",
    schemaUrl: "https://dev-schema.ngotag.com/schemas/ff021513-94b1-407d-a0ee-bb829531df42",
    attributes: [
      "Issuer Name",
      "Student ID",
      "Student Name",
      "Title of Award",
      "College Name",
    ],
  },
};

export const FOUNDATIONAL_ID_SCHEMA = {
  name: "Foundational ID",
  schemaUrl: "https://dev-schema.ngotag.com/schemas/c7952a0a-e9b5-4a4b-a714-1e5d0a1ae076",
  attributes: [
    "Full Name",
    "Gender",
    "Date of Birth",
    "ID Type",
    "ID Number",
    "Citizenship",
  ],
} as const;
