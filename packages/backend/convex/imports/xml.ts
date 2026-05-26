const ROOT_ELEMENT_REGEX = /<([A-Za-z][A-Za-z0-9_:-]*)(?:\s|>)/;

export const extractRootElement = (xml: string): string | undefined => {
  const match = xml.match(ROOT_ELEMENT_REGEX);
  return match?.[1];
};

export const textForTag = (block: string, tagName: string): string => {
  const escaped = tagName.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,
    "i"
  );
  const match = block.match(regex);
  return decodeXml(match?.[1] ?? "").trim();
};

export const blocksForTag = (xml: string, tagName: string): string[] => {
  const escaped = tagName.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<${escaped}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${escaped}>`,
    "gi"
  );
  return xml.match(regex) ?? [];
};

export const decodeXml = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&apos;", "'")
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&quot;", '"');
