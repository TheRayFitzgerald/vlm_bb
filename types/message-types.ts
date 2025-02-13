import { PerplexityMessage, ExtractedCitation } from "@/types";

export interface MessageWithCitations extends PerplexityMessage {
  citations?: string[];
  citationContents?: Record<number, ExtractedCitation>;
}

export interface HighlightedWebpageProps {
  url: string;
  screenshotUrl: string;
  highlights: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

export const HIGHLIGHT_COLORS = [
  "#FFD700", // Gold
  "#90EE90", // Light Green
  "#87CEEB", // Sky Blue
  "#FFA07A", // Light Salmon
  "#DDA0DD", // Plum
  "#F0E68C", // Khaki
];
