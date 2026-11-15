import "@/index.css";

import { FlashcardReview } from "@/components/study/FlashcardReview";
import type { Doc } from "@/convex/_generated/dataModel";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const CONVEX_URL = "https://harmless-dog-538.convex.cloud";
const client = new ConvexReactClient(CONVEX_URL);

/**
 * The exact card from the reported bug. Keeping this as a fixture means the
 * browser test exercises the real FlashcardReview component and its visible
 * answer-checking state without touching a student's production cards.
 */
const card: Doc<"flashcards"> = {
  _id: "k978pbnh6mqbj21gnh34fez7458j459w" as Doc<"flashcards">["_id"],
  _creationTime: 0,
  setId: "kx74qteqqwe9xvkg3pqb8wpw3d8j4agz" as Doc<"flashcards">["setId"],
  userId: "m57168v9j4vxdf440twbw0kxpd8j5391" as Doc<"flashcards">["userId"],
  front:
    "What is the Spanish word for 'my' when referring to a masculine singular noun?",
  back:
    "The Spanish word for 'my' with a masculine singular noun is 'mi'. It does not change for gender or number, only the possessed noun does. Example: 'mi hermano' (my brother).",
  order: 0,
  status: "new",
  reviewCount: 0,
  recallThreshold: 0.75,
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexAuthProvider client={client}>
      <main className="mx-auto max-w-3xl p-6">
        <FlashcardReview cards={[card]} />
      </main>
    </ConvexAuthProvider>
  </StrictMode>,
);
