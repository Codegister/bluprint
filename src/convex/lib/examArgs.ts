/**
 * The exam-question fields `completeGeneration` accepts.
 *
 * The shared generator also produces past-paper metadata (`label`, `section`,
 * `extract`, `data`, and so on). Those fields belong to the paper pipeline, not
 * the study-set argument validator, so they are dropped at this boundary.
 */

export type ExamCriteria = {
  id: string;
  marks: number;
  text: string;
};

export type ExamArgs = {
  question: string;
  marks: number;
  modelAnswer: string;
  markingGuide: string[];
  beyondNotes?: boolean;
  criteria?: ExamCriteria[];
};

export function toExamArgs<T extends ExamArgs>(
  exams: readonly T[],
): ExamArgs[] {
  return exams.map((exam) => {
    const shaped: ExamArgs = {
      question: exam.question,
      marks: exam.marks,
      modelAnswer: exam.modelAnswer,
      markingGuide: exam.markingGuide,
    };
    if (exam.beyondNotes !== undefined) shaped.beyondNotes = exam.beyondNotes;
    if (exam.criteria !== undefined) shaped.criteria = exam.criteria;
    return shaped;
  });
}
