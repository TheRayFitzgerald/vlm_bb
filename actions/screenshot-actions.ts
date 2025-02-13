"use server"

const SCREENSHOT_API_KEY = process.env.SCREENSHOT_API_KEY

if (!SCREENSHOT_API_KEY) {
  throw new Error("Missing SCREENSHOT_API_KEY environment variable")
}

interface ScreenshotOptions {
  url: string
  selector?: string
}

interface ScreenshotActionState {
  isSuccess: boolean
  message: string
  data?: string // base64 image data
  error?: string
}

/**
 * Take a screenshot of a webpage or element using ScreenshotOne API
 */
export async function takeScreenshot({
  url,
  selector,
}: ScreenshotOptions): Promise<ScreenshotActionState> {
  try {
    const params = new URLSearchParams({
      access_key: SCREENSHOT_API_KEY!,
      url: url,
      format: "jpg",
      block_ads: "true",
      block_cookie_banners: "true",
      block_trackers: "true",
      delay: "0",
      timeout: "60",
      response_type: "by_format",
      image_quality: "80",
    } as Record<string, string>)

    // Only add selector if provided
    if (selector) {
      params.append("selector", selector)
    }

    const start = performance.now()
    console.log(`[Screenshot] Taking screenshot of ${url}${selector ? ` selector: ${selector}` : ""}`)

    const response = await fetch(`https://api.screenshotone.com/take?${params}`)

    if (!response.ok) {
      throw new Error(`Screenshot API error: ${response.statusText}`)
    }

    // Get image as base64
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    const time = performance.now() - start

    console.log(`[Screenshot] Got screenshot in ${time.toFixed(0)}ms`)

    return {
      isSuccess: true,
      message: "Successfully took screenshot",
      data: `data:image/jpg;base64,${base64}`,
    }
  } catch (error) {
    console.error("[Screenshot] Error:", error)
    return {
      isSuccess: false,
      message: "Failed to take screenshot",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
} 