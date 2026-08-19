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

export type Channel = {
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  fx: string;
  example: string;
  accent: string;
};

export const CHANNELS: Channel[] = [
  {
    slug: "anime",
    name: "Anime",
    tagline: "Figures, shows & the mainstream explosion",
    icon: "🕸️",
    fx: "ZAP!",
    example: "When did anime go mainstream?",
    accent: "text-spider-red",
  },
  {
    slug: "retro-games",
    name: "Retro Games",
    tagline: "Cartridges, consoles & price history",
    icon: "👾",
    fx: "POW!",
    example: "Should I buy a PS5 now or wait?",
    accent: "text-spider-blue",
  },
  {
    slug: "vinyl",
    name: "Vinyl",
    tagline: "Records, pressings & the comeback",
    icon: "💿",
    fx: "WHAM!",
    example: "When did vinyl outsell CDs?",
    accent: "text-spider-purple",
  },
  {
    slug: "cameras",
    name: "Cameras",
    tagline: "Used gear, glass & collector bodies",
    icon: "📷",
    fx: "KRAK!",
    example: "Is this vintage camera worth it?",
    accent: "text-spider-yellow",
  },
  {
    slug: "web3",
    name: "Web3",
    tagline: "Tokens, NFTs & hype cycles",
    icon: "⛓️",
    fx: "ZZZT!",
    example: "How did NFTs rise and fall?",
    accent: "text-spider-pink",
  },
  {
    slug: "anything",
    name: "Free Search",
    tagline: "Ask about any dimension at all",
    icon: "🔍",
    fx: "THWIP!",
    example: "How did the Pyramids of Giza change?",
    accent: "text-spider-blue",
  },
];

export const MODELS = {
  primary: "thinkingmachines/inkling",
  vision: "meta/muse-glimmer-30b",
  conversational: "nvidia/nemotron-3.5-lightning-30b-a3b",
  ocr: "nvidia/nemotron-parse",
  backup: "minimaxai/minimax-m3",
} as const;
