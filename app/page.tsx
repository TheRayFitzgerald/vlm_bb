"use client";

import { perplexityAction } from "@/actions/perplexity-actions";
import { takeScreenshot } from "@/actions/screenshot-actions";
import { findContentCoordinatesWithGeminiAction } from "@/actions/gemini-actions";
import { MessageWithCitations } from "@/types/message-types";
import { ExtractedCitation, LoadingState } from "@/types";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { MessageContent } from "./_components/message-content";
import ReactMarkdown from "react-markdown";
import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { LoadingStatus } from "./_components/loading-status";

export default function Home() {
  const [messages, setMessages] = useState<MessageWithCitations[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    status: 'idle',
    message: ''
  });
  const [isGridReady, setIsGridReady] = useState(false);

  // Preload the grid
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsGridReady(true);
    });
  }, []);

  const handleExampleClick = (exampleText: string) => {
    setInput(exampleText);
    // Use setTimeout to ensure state is updated before submitting
    setTimeout(() => {
      handleSubmit(undefined, exampleText);
    }, 0);
  };

  async function handleSubmit(e?: React.FormEvent, forcedInput?: string) {
    e?.preventDefault();
    const textToSubmit = forcedInput || input;
    if (!textToSubmit.trim() || isLoading) return;

    const userMessage: MessageWithCitations = {
      role: "user",
      content: textToSubmit.trim(),
    };

    setIsLoading(true);
    setInput("");
    setMessages((prev) => [...prev, userMessage]);
    setLoadingState({ status: 'thinking', message: 'Thinking...' });

    try {
      const response = await perplexityAction({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI assistant. Be concise and clear in your responses.",
          },
          ...messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          userMessage,
        ],
        temperature: 0.7,
        top_p: 0.9,
      });

      if (response.isSuccess && response.data) {
        const content = response.data.choices[0].message.content;
        const citations = response.data.citations;

        const citedIndexes = Array.from(content.matchAll(/\[(\d+)\]/g))
          .map((match) => parseInt(match[1]))
          .filter((index) => index <= citations.length);

        const citationContents: Record<number, ExtractedCitation> = {};

        if (citedIndexes.length > 0) {
          const firstIndex = citedIndexes[0];
          try {
            const url = citations[firstIndex - 1];
            setLoadingState({ 
              status: 'taking-screenshot', 
              message: 'Taking screenshot of cited webpage...' 
            });
            
            const screenshotResult = await takeScreenshot({
              url,
            });

            if (!screenshotResult.isSuccess || !screenshotResult.data) {
              throw new Error("Failed to take screenshot");
            }

            setLoadingState({ 
              status: 'processing-citations', 
              message: 'Processing citations with AI...' 
            });

            const coordinatesResult =
              await findContentCoordinatesWithGeminiAction(
                screenshotResult.data.replace(/^data:image\/\w+;base64,/, ""),
                content
              );

            if (coordinatesResult.isSuccess && coordinatesResult.data) {
              citationContents[firstIndex] = {
                url: citations[firstIndex - 1],
                relevantContent: coordinatesResult.data.text,
                explanation: "Found using Gemini Vision",
                screenshotUrl: screenshotResult.data,
                highlights: [
                  {
                    text: coordinatesResult.data.text,
                    bbox: coordinatesResult.data.coordinates,
                  },
                ],
              };
            }
          } catch (error) {
            console.error("Error processing citation:", error);
          }
        }

        const assistantMessage: MessageWithCitations = {
          ...response.data.choices[0].message,
          citations,
          citationContents,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      setLoadingState({ status: 'idle', message: '' });
    }
  }

  if (!isGridReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#1C1C1C]" />
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#1C1C1C] text-white">
      <FlickeringGrid
        className="absolute inset-0 z-0"
        squareSize={4}
        gridGap={6}
        color="#6B7280"
        maxOpacity={0.15}
        flickerChance={0.7}
      />

      <div className="relative z-10 flex min-h-screen flex-col">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4">
            <h1 className="mb-8 text-4xl font-medium text-white/90">
              What do you want to know?
            </h1>

            <div className="w-full max-w-2xl">
              <div className="relative flex h-[64px] items-center rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask anything..."
                  className="w-full border-0 bg-transparent px-6 pr-14 text-xl text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-0"
                  disabled={isLoading}
                />
                <div className="absolute right-3">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => handleSubmit()}
                    className="size-[38px] rounded-lg bg-white/10 p-0 hover:bg-white/20"
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin text-white/80" />
                    ) : (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 15 15"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-white/80"
                      >
                        <path
                          d="M1 7.5H14M14 7.5L8 1.5M14 7.5L8 13.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </Button>
                </div>
              </div>

              <div className="mt-8">
                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() =>
                      handleExampleClick(
                        "What's the height of the Burj Khalifa?"
                      )
                    }
                    className="rounded-lg bg-[#2A2A2A]/80 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-[#2A2A2A] hover:text-white/90"
                  >
                    What&apos;s the height of the Burj Khalifa?
                  </button>
                  <button
                    onClick={() =>
                      handleExampleClick("When was Richard Nixon impeached?")
                    }
                    className="rounded-lg bg-[#2A2A2A]/80 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-[#2A2A2A] hover:text-white/90"
                  >
                    When was Richard Nixon impeached?
                  </button>
                  <button
                    onClick={() =>
                      handleExampleClick("How many parameters does GPT-4 have?")
                    }
                    className="rounded-lg bg-[#2A2A2A]/80 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-[#2A2A2A] hover:text-white/90"
                  >
                    How many parameters does GPT-4 have?
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-20 flex-1 space-y-6 p-4 pt-8 md:p-8 md:pt-12">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`mx-auto max-w-2xl ${
                    message.role === "user"
                      ? "flex justify-end"
                      : "flex justify-start"
                  }`}
                >
                  <div
                    className={`relative flex w-fit max-w-[85%] flex-col rounded-2xl px-4 py-3.5 text-lg md:px-5 md:py-4 ${
                      message.role === "user"
                        ? "bg-blue-500/20 text-white/90 backdrop-blur-sm"
                        : "bg-[#2A2A2A]/80 text-white/80 backdrop-blur-sm"
                    }`}
                  >
                    <MessageContent
                      message={message}
                      renderContent={(content) =>
                        message.role === "assistant" ? (
                          <div className="prose prose-invert prose-headings:mb-2 prose-headings:mt-2 prose-p:my-1 prose-pre:my-0 prose-ul:my-2 prose-li:my-0.5 max-w-none">
                            <ReactMarkdown>{content}</ReactMarkdown>
                          </div>
                        ) : (
                          content
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              
              {loadingState.status !== 'idle' && (
                <LoadingStatus loadingState={loadingState} />
              )}
            </div>

            <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#1C1C1C]/80 backdrop-blur-sm p-4">
              <div className="relative mx-auto max-w-2xl">
                <div className="relative flex h-[64px] items-center rounded-xl bg-[#2A2A2A]/80 backdrop-blur-sm">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    placeholder="Ask anything..."
                    className="w-full border-0 bg-transparent px-6 pr-14 text-xl text-white/90 placeholder:text-white/40 focus:outline-none focus:ring-0"
                    disabled={isLoading}
                  />
                  <div className="absolute right-3">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => handleSubmit()}
                      className="size-[38px] rounded-lg bg-white/10 p-0 hover:bg-white/20"
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin text-white/80" />
                      ) : (
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="text-white/80"
                        >
                          <path
                            d="M1 7.5H14M14 7.5L8 1.5M14 7.5L8 13.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
