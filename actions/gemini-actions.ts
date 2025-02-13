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
): Promise<ActionState<{ text: string; coordinates: Array<{ x0: number; y0: number; x1: number; y1: number }> }>> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Google API key not found")
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro-exp-02-05" })

    const prompt = `Return bounding boxes as JSON arrays [ymin, xmin, ymax, xmax].

Return bounding boxes that capture details about "${content}".
Return multiple bounding boxes if there are multiple instances of the content.
Ensure each bounding box is solely focussed on capturing the specific content.
This is important - we want to cite the exact content, not the surrounding text.`

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

    // Convert all coordinates to the x0,y0,x1,y1 format
    const formattedCoordinates = coordinates.map(([y0_bottom, x0, y1_top, x1]) => ({
      x0: x0 / 1000,
      y0: y0_bottom / 1000,
      x1: x1 / 1000,
      y1: y1_top / 1000
    }))
    
    return {
      isSuccess: true,
      message: "Successfully found content coordinates",
      data: {
        text: content,
        coordinates: formattedCoordinates
      }
    }
  } catch (error) {
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to find content coordinates"
    }
  }
} 