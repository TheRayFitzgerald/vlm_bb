export interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PerplexityRequest {
  model: "sonar";
  messages: PerplexityMessage[];
  temperature?: number;
  top_p?: number;
}

export interface PerplexityChoice {
  message: PerplexityMessage;
}

export interface PerplexityResponse {
  citations: string[];
  choices: PerplexityChoice[];
}

export interface PerplexityActionState {
  isSuccess: boolean;
  message: string;
  data?: PerplexityResponse;
  error?: string;
}
