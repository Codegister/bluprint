import { describe, expect, test } from "bun:test";

import {
  countdownAnchor,
  daysBetweenKeys,
  defaultPlanDates,
  plannedSessionCount,
} from "../src/lib/timetable";

describe("timetable dates", () => {
  test("a plan built today starts today", () => {
    const today = new Date(2026, 10, 21, 9, 0, 0);
    const dates = defaultPlanDates(today);
    expect(dates.startDate).toBe("2026-11-21");
    expect(dates.examDate).toBe("2026-12-20");
  });

  test("the countdown runs from the plan start, not from today", () => {
    // Built on 21 November for a 22 November start: the strip opens on the
    // 22nd, so the header counts from the 22nd too.
    const anchor = countdownAnchor("2026-11-22", "2026-11-21");
    expect(anchor).toBe("2026-11-22");
    expect(daysBetweenKeys(anchor, "2026-12-21")).toBe(29);
  });

  test("an already-started plan counts from today", () => {
    expect(countdownAnchor("2026-11-01", "2026-11-21")).toBe("2026-11-21");
    expect(daysBetweenKeys("2026-11-21", "2026-11-22")).toBe(1);
  });

  test("a rest day holds no sessions, and a revision day holds the plan's real count", () => {
    expect(plannedSessionCount(0, 45)).toBe(0);
    expect(plannedSessionCount(60, 45)).toBe(1);
    expect(plannedSessionCount(180, 45)).toBe(4);
  });
});
