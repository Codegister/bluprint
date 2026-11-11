export type PageMeta = {
  title: string;
  description: string;
  /** Private, tokenised or personal screens stay out of search results. */
  noindex: boolean;
};

const SITE = "Bluprint";
const DESCRIPTION =
  "Turn your notes into flashcards, quiz questions and an exam answer marked against the scheme.";

const PUBLIC: Record<string, PageMeta> = {
  "/": {
    title: "Bluprint: your notes come back marked",
    description:
      "Turn your notes into flashcards, quiz questions and an exam answer marked against the scheme.",
    noindex: false,
  },
  "/privacy": {
    title: "Privacy · Bluprint",
    description:
      "What Bluprint stores, who can read it, and how to export or delete your work.",
    noindex: false,
  },
  "/terms": {
    title: "Terms · Bluprint",
    description: "The terms that apply when you use Bluprint.",
    noindex: false,
  },
  "/contact": {
    title: "Contact · Bluprint",
    description: "How to contact the person who runs Bluprint.",
    noindex: false,
  },
};

/**
 * Metadata is derived from the route only. It never reads a set title, a
 * course, an email address or a share token, so personal content cannot end up
 * in a browser tab, a bookmark, a history entry or a link preview.
 */
export function pageMetaFor(pathname: string): PageMeta {
  const path = pathname.split("?")[0]?.split("#")[0] || "/";
  const exact = PUBLIC[path];
  if (exact) return exact;

  if (path === "/auth") {
    return {
      title: "Sign in · Bluprint",
      description: "Sign in to your own Bluprint workspace.",
      noindex: true,
    };
  }
  if (path.startsWith("/share/")) {
    return {
      title: "Shared progress · Bluprint",
      description: "A revocable progress summary shared from Bluprint.",
      noindex: true,
    };
  }
  if (path === "/today") {
    return {
      title: "Today · Bluprint",
      description: "The cards due today and the weak spots worth a second pass.",
      noindex: true,
    };
  }
  if (path === "/courses" || path === "/courses/new") {
    return {
      title: path.endsWith("/new") ? "Set up courses · Bluprint" : "Courses · Bluprint",
      description: "Your courses and their revision pathways.",
      noindex: true,
    };
  }
  if (path.startsWith("/courses/")) {
    return {
      title: "Course pathway · Bluprint",
      description: "A course pathway, its topics and the sets built from them.",
      noindex: true,
    };
  }
  if (path === "/past-papers") {
    return {
      title: "Question bank · Bluprint",
      description: "Practise real past-paper questions with mark-scheme feedback.",
      noindex: true,
    };
  }
  if (path === "/timetable" || path.startsWith("/timetable/")) {
    return {
      title: "Timetable · Bluprint",
      description: "Your revision timetable, built from your courses and exam dates.",
      noindex: true,
    };
  }
  if (path.startsWith("/sets/")) {
    const section = path.split("/")[3];
    const label =
      section === "cards"
        ? "Flashcards"
        : section === "quiz"
          ? "Quiz"
          : section === "exam"
            ? "Exam practice"
            : section === "weak"
              ? "Weak spots"
              : section === "mock"
                ? "Timed mock"
                : "Study set";
    return {
      title: `${label} · ${SITE}`,
      description: "A private study set built from your own notes.",
      noindex: true,
    };
  }
  if (path === "/tutor" || path === "/dashboard") {
    return {
      title: "Tutor · Bluprint",
      description: "Ask the tutor, continue a set or open your saved material.",
      noindex: true,
    };
  }
  return {
    title: `Page not found · ${SITE}`,
    description: DESCRIPTION,
    noindex: true,
  };
}

/** One place for the description tag so every route updates it the same way. */
export function applyPageMeta(pathname: string): void {
  const meta = pageMetaFor(pathname);
  document.title = meta.title;

  let description = document.head.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  );
  if (!description) {
    description = document.createElement("meta");
    description.name = "description";
    document.head.appendChild(description);
  }
  description.content = meta.description;

  let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
  if (meta.noindex) {
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex, nofollow";
  } else if (robots) {
    robots.remove();
  }

  let canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (meta.noindex) {
    if (canonical) canonical.remove();
  } else {
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `https://codegister.github.io/bluprint${pathname === "/" ? "/" : pathname}`;
  }
}
