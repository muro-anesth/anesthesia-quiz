export interface Question {
  id: string;
  qnum: number;
  year: string;
  category: string;
  stem: string;
  choices: { a: string; b: string; c: string; d: string; e: string };
  answer: string;
  is_image_question: boolean;
  main_image: string | null;
  question_type: string;
  subitems: Record<string, string> | null;
  option_images: string[];
  explanation: string | null;
}
export type Phase =
  | "home"
  | "loading"
  | "question"
  | "answered"
  | "summary"
  | "empty"
  | "stats"
  | "review_list"
  | "settings"
  | "exam_select"
  | "exam_question"
  | "exam_answered"
  | "exam_result"
  | "exam_history"
  | "exam_transition";
export const CHOICE_KEYS = ["a", "b", "c", "d", "e"] as const;
export type ChoiceKey = (typeof CHOICE_KEYS)[number];
