"use client";

import { MessageWithCitations } from "@/types/message-types";
import { HighlightedWebpage } from "./highlighted-webpage";

interface MessageContentProps {
  message: MessageWithCitations;
  renderContent?: (content: string) => React.ReactNode;
}

export function MessageContent({ message, renderContent }: MessageContentProps) {
  // For user messages, just return the content directly
  if (message.role === "user") {
    return <div>{message.content}</div>;
  }

  // For assistant messages, handle citations and markdown
  const citationMatch = message.content.match(/\[(\d+)\]/);
  const citationNumber = citationMatch ? parseInt(citationMatch[1]) : null;
  const citation = citationNumber ? message.citationContents?.[citationNumber] : null;
  const citationUrl = citationNumber ? message.citations?.[citationNumber - 1] : null;

  // Clean the content by removing citation numbers
  const cleanContent = message.content.replace(/\[\d+\]/g, "");

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          {renderContent ? renderContent(cleanContent) : cleanContent}
          {citationUrl && (
            <a 
              href={citationUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="ml-1 text-blue-400 hover:text-blue-300 hover:underline"
            >
              [{citationNumber}]
            </a>
          )}
        </div>
        {citation && <HighlightedWebpage citation={citation} />}
      </div>
    </div>
  );
}
