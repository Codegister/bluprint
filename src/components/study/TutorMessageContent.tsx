import { TutorDiagram } from "./TutorDiagram";
import { parseTutorContent } from "@/lib/tutorDiagrams";

/**
 * Renders one tutor answer. Prose keeps the chat's whitespace, while complete
 * diagram fences become sanitised diagrams; every other fence stays text.
 */
export function TutorMessageContent({ content }: { content: string }) {
  const segments = parseTutorContent(content);
  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "text" ? (
          <span key={`text-${index}`} className="whitespace-pre-wrap">
            {segment.text}
          </span>
        ) : (
          <TutorDiagram
            key={`diagram-${index}`}
            format={segment.format}
            source={segment.source}
          />
        ),
      )}
    </>
  );
}
