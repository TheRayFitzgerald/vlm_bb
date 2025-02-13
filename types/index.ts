export * from "./perplexity-types";
export * from "./action-types";

export interface ExtractedCitation {
  url: string;
  relevantContent: string;
  explanation: string;
  screenshotUrl: string;
  highlights: Array<{
    text: string;
    bbox: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export interface PerplexityMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LoadingState {
  status: 'idle' | 'thinking' | 'taking-screenshot' | 'processing-citations'
  message: string
}
