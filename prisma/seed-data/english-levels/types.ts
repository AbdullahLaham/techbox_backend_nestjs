export type SeedQuestion = {
  text: string;
  /** Always written first here; the seed shuffles the options into a stable order. */
  correct: string;
  wrong: [string, string, string];
  explanation: string;
};

export type SeedModule = {
  title: string;
  titleAr: string;
  description: string;
  questions: SeedQuestion[];
};

export type SeedLevel = {
  title: string;
  description: string;
  modules: SeedModule[];
};

export function q(
  text: string,
  correct: string,
  wrong: [string, string, string],
  explanation: string,
): SeedQuestion {
  return { text, correct, wrong, explanation };
}
