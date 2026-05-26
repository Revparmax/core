import { identifyOperaReport, parseOperaReport } from "./opera/profile";
import { identifyPepReport, parsePepReport } from "./pep/profile";
import type {
  IdentifiedReport,
  ImportAttachment,
  ParsedHotelReport,
} from "./types";

export const identifyReport = (
  attachment: ImportAttachment
): IdentifiedReport => {
  const identified =
    identifyOperaReport(attachment) ?? identifyPepReport(attachment);

  if (identified) {
    return identified;
  }

  return {
    confidence: 0,
    profile: {
      id: "unknown.default",
      isDefault: true,
      label: "Unknown default parser",
      systemType: "pep",
    },
    reportType: "unknown",
    signature: "unknown",
  };
};

export const parseAttachment = (
  attachment: ImportAttachment
): ParsedHotelReport => {
  const identified = identifyReport(attachment);

  if (identified.profile.systemType === "opera") {
    return parseOperaReport(attachment, identified);
  }

  if (identified.profile.systemType === "pep") {
    return parsePepReport(attachment, identified);
  }

  return {
    confidence: 0,
    filename: attachment.filename,
    profileId: identified.profile.id,
    reportType: "unknown",
    rowCount: 0,
    systemType: "pep",
    warnings: ["No parser profile matched this attachment."],
  };
};

export const parseAttachments = (
  attachments: ImportAttachment[]
): ParsedHotelReport[] => attachments.map(parseAttachment);
