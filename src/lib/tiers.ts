export type Tier = {
  id: string;
  name: string;
  blurb: string;
  sol: number;
  millionTokens: number;
  rpm: number;
  perks: string[];
  featured?: boolean;
};

export const MODEL = "Claude Fable 5";
export const MODEL_RATE = `${MODEL} · $10/1M input · $50/1M output`;

export const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "For side projects and for finding out whether this works for you",
    sol: 0.5,
    millionTokens: 1,
    rpm: 60,
    perks: ["Standard support"],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For apps that have shipped and need to stay up",
    sol: 2.5,
    millionTokens: 10,
    rpm: 300,
    perks: ["Priority support", "Usage dashboard"],
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "For teams running this at scale",
    sol: 15,
    millionTokens: 100,
    rpm: 1000,
    perks: ["Dedicated support", "Custom rate limits", "SLA guarantee"],
  },
];
