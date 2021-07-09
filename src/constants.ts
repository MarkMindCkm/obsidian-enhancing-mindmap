export const MM_VIEW_TYPE = 'mindmap';
export const MD_VIEW_TYPE = 'markdown';

export const FRONT_MATTER_REGEX = /^(---)$.+?^(---)$.+?/ims;

export const frontMatterKey = 'mindmap-plugin';


export const basicFrontmatter = [
  "---",
  "",
  `${frontMatterKey}: basic`,
  "",
  "---",
  "",
  "",
].join("\n");

