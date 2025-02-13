"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import { ActionState } from "@/types"

interface GeminiResponse {
  text: string
  coordinates?: number[][]
}

export async function processImageWithGeminiAction(
  image: string,
  prompt: string,
  model: string
): Promise<ActionState<GeminiResponse>> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Google API key not found")
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const geminiModel = genAI.getGenerativeModel({ model })

    // Convert base64 data URL to inline data
    const base64Data = image.split(",")[1]
    const mimeType = image.split(";")[0].split(":")[1]

    const result = await geminiModel.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType
        }
      }
    ])

    const response = await result.response
    const text = response.text()

    // Extract coordinates from the response
    const coordinates = extractCoordinates(text)

    return {
      isSuccess: true,
      message: "Successfully processed image",
      data: {
        text,
        coordinates
      }
    }
  } catch (error) {
    console.error("Error processing image with Gemini:", error)
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to process image"
    }
  }
}

function extractCoordinates(text: string): number[][] {
  const regex = /\[?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]?/g
  const matches = Array.from(text.matchAll(regex))
  return matches.map(match => [
    parseInt(match[1]),
    parseInt(match[2]),
    parseInt(match[3]),
    parseInt(match[4])
  ])
}

export async function findContentCoordinatesWithGeminiAction(
  base64Image: string,
  content: string
): Promise<ActionState<{ text: string; coordinates: { x0: number; y0: number; x1: number; y1: number } }>> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Google API key not found")
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro-exp-02-05" })

    const prompt = `Return bounding boxes as JSON arrays [ymin, xmin, ymax, xmax].

Return at least one bounding box that captures details about "${content}".
Ensure the bounding box is solely focussed on capturing the specific content.
This is important - we want to cite the exact content, not the surrounding text.
Only return more than one bounding box if needed.`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      }
    ])

    const response = await result.response
    const text = response.text()
    const coordinates = extractCoordinates(text)

    if (coordinates.length === 0) {
      throw new Error("No coordinates found in response")
    }

    const [y0_bottom, x0, y1_top, x1] = coordinates[0].map(v => v / 1000)
    
    return {
      isSuccess: true,
      message: "Successfully found content coordinates",
      data: {
        text: content,
        coordinates: {
          x0: x0,
          y0: y0_bottom,
          x1: x1,
          y1: y1_top
        }
      }
    }
  } catch (error) {
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to find content coordinates"
    }
  }
} 