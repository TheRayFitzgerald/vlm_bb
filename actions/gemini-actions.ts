"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import { ActionState } from "@/types"

interface GeminiResponse {
  text: string
  coordinates?: number[][]
}

interface BoundingBoxContent {
  coordinates: { x0: number; y0: number; x1: number; y1: number }
  text: string
}

interface ExtractedField {
  label: string
  value: string
}

interface SearchContext {
  value: string
  label: string
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
): Promise<ActionState<{ query: string; boxes: BoundingBoxContent[]; debug?: { rawResponse: string } }>> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Google API key not found")
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro-exp-02-05" })

    // First, let's parse the instruction to handle both direct searches and complex extractions
    const isDirectSearch = content.includes('"') && !content.toLowerCase().includes('extract') && !content.toLowerCase().includes('find')
    const prompt = isDirectSearch 
      ? `Return bounding boxes and their content as JSON arrays in the format: [ymin, xmin, ymax, xmax, "extracted text"].

Task: Find the following specific phrases in the image: ${content}

Rules:
1. Each box should capture a complete, distinct instance of a phrase
2. Avoid overlapping boxes - if phrases overlap, choose the clearer/more complete instance
3. Focus on capturing the exact content, not surrounding context
4. Ensure boxes are as tight as possible around the content
5. If the same phrase appears multiple times, prioritize instances that are clearly separated

Return the boxes in order of confidence/clarity.
Include the extracted text for each box to verify accuracy.

IMPORTANT: Your response MUST contain arrays in the format [ymin, xmin, ymax, xmax, "extracted text"].
If you find any matching phrases, you MUST return at least one array.`
      : `Return bounding boxes and their content as JSON arrays in the format: [ymin, xmin, ymax, xmax, "extracted text"].

Task: ${content}

Rules for extracting information:
1. For each piece of information requested, find its location in the image
2. Create a bounding box around each relevant piece of information
3. Extract the exact text from within each box
4. Ensure boxes are precise and focused on the specific information
5. If multiple instances exist, choose the clearest/most relevant one

Example of expected response for a form field:
[120, 450, 150, 600, "January 15, 2024"]

IMPORTANT: Your response MUST contain arrays in the format [ymin, xmin, ymax, xmax, "extracted text"].
Return one array for each piece of information found.
Do not explain or describe - only return the arrays.`

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

    // Updated regex to capture text content
    const regex = /\[?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"([^"]+)"\s*\]?/g
    const matches = Array.from(text.matchAll(regex))
    
    if (matches.length === 0) {
      return {
        isSuccess: false,
        message: "No coordinates and text content found in response",
        data: {
          query: content,
          boxes: [],
          debug: {
            rawResponse: text
          }
        }
      }
    }

    // Convert coordinates and include extracted text
    const boxes = matches.map(match => ({
      coordinates: {
        x0: parseInt(match[2]) / 1000,
        y0: parseInt(match[1]) / 1000,
        x1: parseInt(match[4]) / 1000,
        y1: parseInt(match[3]) / 1000
      },
      text: match[5]
    }))
    
    return {
      isSuccess: true,
      message: "Successfully found content coordinates and text",
      data: {
        query: content,
        boxes,
        debug: {
          rawResponse: text
        }
      }
    }
  } catch (error) {
    console.error("Error processing with Gemini:", error)
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to find content coordinates and text",
      data: {
        query: content,
        boxes: [],
        debug: {
          rawResponse: error instanceof Error ? error.message : "Unknown error"
        }
      }
    }
  }
}

export async function extractTextFromImageAction(
  base64Image: string,
  instruction: string
): Promise<ActionState<{ fields: ExtractedField[]; debug?: { rawResponse: string } }>> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Google API key not found")
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro-exp-02-05" })

    const prompt = `Task: ${instruction}

Extract all relevant information from the image following these rules:
1. Find each distinct piece of requested information
2. Be thorough - extract all relevant text, even if partially visible
3. For each field, capture the complete text
4. If multiple instances exist, choose the clearest/most complete one
5. Include any contextual information that helps identify the field

Return the results as key-value pairs in this format:
[label]: [extracted text]

Example response for a form:
Form Number: 5500-SF
Start Date: 01/01/2023
End Date: 12/31/2023
Plan Liabilities (Start): $1,234,567
Plan Liabilities (End): $2,345,678

IMPORTANT:
- Extract ALL relevant information
- Be precise with numbers, dates, and identifiers
- Include units and symbols if present
- Return ONLY the key-value pairs, no other text or explanations`

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

    // Parse the response into fields
    const fields = text
      .split('\n')
      .filter(line => line.includes(':'))
      .map(line => {
        const [label, ...valueParts] = line.split(':')
        return {
          label: label.trim(),
          value: valueParts.join(':').trim()
        }
      })

    if (fields.length === 0) {
      return {
        isSuccess: false,
        message: "No fields extracted from the image",
        data: {
          fields: [],
          debug: { rawResponse: text }
        }
      }
    }

    return {
      isSuccess: true,
      message: "Successfully extracted text from image",
      data: {
        fields,
        debug: { rawResponse: text }
      }
    }
  } catch (error) {
    console.error("Error extracting text:", error)
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to extract text",
      data: {
        fields: [],
        debug: { rawResponse: error instanceof Error ? error.message : "Unknown error" }
      }
    }
  }
}

export async function findBoundingBoxesForTextAction(
  base64Image: string,
  searchTexts: SearchContext[]
): Promise<ActionState<{ boxes: BoundingBoxContent[]; debug?: { rawResponse: string } }>> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Google API key not found")
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-pro-exp-02-05" })

    const contextList = searchTexts.map(({ label, value }) => 
      `"${value}" (labeled as "${label}")`
    ).join(', ')

    const prompt = `Find the exact location of these form fields in the image: ${contextList}

Return bounding boxes as JSON arrays in the format: [ymin, xmin, ymax, xmax, "matched text"]

Rules:
1. Each box should capture the complete text value
2. Boxes should be as tight as possible around the value
3. Return one array per found text
4. Coordinates should be in range 0-1000
5. Use the label context to help identify the correct text
6. Only return boxes for the actual values, not the labels

Example response for "January 15, 2024" (labeled as "Start Date"):
[120, 450, 150, 600, "January 15, 2024"]

IMPORTANT: Only return the arrays, no other text or explanations.`

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

    // Extract coordinates and text
    const regex = /\[?\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"([^"]+)"\s*\]?/g
    const matches = Array.from(text.matchAll(regex))
    
    if (matches.length === 0) {
      return {
        isSuccess: false,
        message: "No bounding boxes found in response",
        data: {
          boxes: [],
          debug: { rawResponse: text }
        }
      }
    }

    const boxes = matches.map(match => ({
      coordinates: {
        x0: parseInt(match[2]) / 1000,
        y0: parseInt(match[1]) / 1000,
        x1: parseInt(match[4]) / 1000,
        y1: parseInt(match[3]) / 1000
      },
      text: match[5]
    }))
    
    return {
      isSuccess: true,
      message: "Successfully found bounding boxes",
      data: {
        boxes,
        debug: { rawResponse: text }
      }
    }
  } catch (error) {
    console.error("Error finding bounding boxes:", error)
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to find bounding boxes",
      data: {
        boxes: [],
        debug: { rawResponse: error instanceof Error ? error.message : "Unknown error" }
      }
    }
  }
} 