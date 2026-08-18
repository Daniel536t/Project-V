export const SITE_NAME = "ORACLE";

export type QuestionType = {
  title: string;
  description: string;
  icon: string;
  accent: string;
  example: string;
};

export const QUESTION_TYPES: QuestionType[] = [
  {
    title: "BUY OR WAIT?",
    description: "Price prediction from 25 years of historical trends.",
    icon: "📈",
    accent: "bg-spider-blue/15 text-spider-blue",
    example: "Should I buy a PS5 now or wait?",
  },
  {
    title: "RARE OR NOT?",
    description: "Scarcity and valuation analysis from an uploaded photo.",
    icon: "🔍",
    accent: "bg-spider-purple/15 text-spider-purple",
    example: "Is this vintage sneaker actually rare?",
  },
  {
    title: "WHEN DID IT CHANGE?",
    description: "Cultural and market inflection points as interactive timelines.",
    icon: "🕸️",
    accent: "bg-spider-red/15 text-spider-red",
    example: "When did vinyl records make a comeback?",
  },
];

export const MODELS = {
  primary: "thinkingmachines/inkling",
  vision: "meta/muse-glimmer-30b",
  conversational: "nvidia/nemotron-3.5-lightning-30b-a3b",
  ocr: "nvidia/nemotron-parse",
  backup: "minimaxai/minimax-m3",
} as const;
