"use server"

import { PerplexityActionState, PerplexityRequest } from "@/types/perplexity-types"

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY

if (!PERPLEXITY_API_KEY) {
  throw new Error("Missing PERPLEXITY_API_KEY environment variable")
}

export async function perplexityAction(
  request: PerplexityRequest
): Promise<PerplexityActionState> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Perplexity API error: ${error}`)
    }

    const data = await response.json()

    return {
      isSuccess: true,
      message: "Successfully called Perplexity API",
      data,
    }
  } catch (error) {
    console.error("Error calling Perplexity API:", error)
    return {
      isSuccess: false,
      message: "Failed to call Perplexity API",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
} 