import { z } from 'zod'

// P0 — Fix B: the LLM output is validated at runtime. A malformed response
// (missing field, wrong option count, out-of-range answer index) is rejected
// here instead of crashing the render layer downstream.

const nonEmpty = z.string().trim().min(1)

export const vocabularyItemSchema = z.object({
  word: nonEmpty,
  pos: nonEmpty, // part-of-speech abbreviation, e.g. "n.", "v.", "a.", "ad."
  meaning: nonEmpty, // Korean definition
})

export const multipleChoiceSchema = z.object({
  question: nonEmpty,
  question_ko: nonEmpty,
  options: z.array(nonEmpty).length(5),
  // 1-based index into `options`; must point at a real option.
  answer: z.number().int().min(1).max(5),
  explanation: nonEmpty, // Korean explanation
})

export const subjectiveSchema = z.object({
  question: nonEmpty,
  question_ko: nonEmpty,
  answer: nonEmpty,
})

export const keySentenceSchema = z.object({
  english: nonEmpty,
  korean: nonEmpty,
})

export const worksheetSchema = z
  .object({
    index: nonEmpty,
    title: nonEmpty,
    story: z.array(nonEmpty).min(1),
    story_ko: z.array(nonEmpty).min(1),
    multiple_choice: z.array(multipleChoiceSchema).length(5),
    subjective: z.array(subjectiveSchema).length(5),
    key_sentences: z.array(keySentenceSchema).min(1),
    vocabulary: z.array(vocabularyItemSchema).min(6).max(8),
  })
  .superRefine((data, ctx) => {
    // The Korean translation must align paragraph-for-paragraph with the story.
    if (data.story.length !== data.story_ko.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['story_ko'],
        message: `story_ko length (${data.story_ko.length}) must equal story length (${data.story.length})`,
      })
    }
  })

export type VocabularyItem = z.infer<typeof vocabularyItemSchema>
export type MultipleChoice = z.infer<typeof multipleChoiceSchema>
export type Subjective = z.infer<typeof subjectiveSchema>
export type KeySentence = z.infer<typeof keySentenceSchema>
export type Worksheet = z.infer<typeof worksheetSchema>

// BYOT (Bring Your Own Text): the model returns everything EXCEPT the English
// passage, which the teacher supplied and we inject client-side.
export const byotOutputSchema = z.object({
  index: nonEmpty,
  title: nonEmpty,
  story_ko: z.array(nonEmpty).min(1),
  multiple_choice: z.array(multipleChoiceSchema).length(5),
  subjective: z.array(subjectiveSchema).length(5),
  key_sentences: z.array(keySentenceSchema).min(1),
  vocabulary: z.array(vocabularyItemSchema).min(6).max(8),
})

export type ByotOutput = z.infer<typeof byotOutputSchema>

/** Combine teacher paragraphs with the model output into a full Worksheet. */
export function assembleWorksheet(story: string[], out: ByotOutput): Worksheet {
  return { ...out, story }
}
