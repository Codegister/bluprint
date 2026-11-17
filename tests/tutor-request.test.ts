import { describe, expect, test } from "bun:test";
import {
  beginTutorRequest,
  isActiveTutorRequest,
  stopTutorRequest,
} from "../src/lib/tutorRequest";

/**
 * The composer race: Stop ends the running request immediately, but its Convex
 * action settles later. These tests pin who is allowed to write state.
 */
describe("tutor request ownership", () => {
  test("a send takes the next id and owns the composer", () => {
    let active = 0;
    const first = beginTutorRequest(active);
    active = first;

    expect(first).toBe(1);
    expect(isActiveTutorRequest(active, first)).toBe(true);
  });

  test("a newer send supersedes the one before it", () => {
    let active = 0;
    const first = beginTutorRequest(active);
    active = first;
    const second = beginTutorRequest(active);
    active = second;

    expect(isActiveTutorRequest(active, first)).toBe(false);
    expect(isActiveTutorRequest(active, second)).toBe(true);
  });

  test("stop takes ownership before the request settles", () => {
    let active = 0;
    const first = beginTutorRequest(active);
    active = first;

    active = stopTutorRequest(active);

    // The stopped request's finally/catch can no longer clear the composer.
    expect(isActiveTutorRequest(active, first)).toBe(false);
  });

  test("stopping and sending again keeps the new request's state", () => {
    let active = 0;
    const first = beginTutorRequest(active);
    active = first;
    active = stopTutorRequest(active);
    const second = beginTutorRequest(active);
    active = second;

    // This is the regression: before ids, the first request's finally cleared
    // sending/pending for the second, leaving a live answer looking idle.
    expect(isActiveTutorRequest(active, first)).toBe(false);
    expect(isActiveTutorRequest(active, second)).toBe(true);
  });

  test("only the current request may report an error", () => {
    let active = 0;
    const first = beginTutorRequest(active);
    active = first;
    const second = beginTutorRequest(active);
    active = second;

    const firstMayReport = isActiveTutorRequest(active, first);
    const secondMayReport = isActiveTutorRequest(active, second);

    expect(firstMayReport).toBe(false);
    expect(secondMayReport).toBe(true);
  });
});
