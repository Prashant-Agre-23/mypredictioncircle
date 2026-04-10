// Bollywood-style fun loading messages
export const loadingDialogues = [
  '⏳ "Intezaar karo... kuch bade hone wala hai..."',
  '🧘 "Sabr karo bhai... achi cheezein der se aati hain"',
  '😂 "Arre bhai! Data aa gaya kya? Nahi? Aayega na!"',
];

export const getRandomDialogue = (): string => {
  return loadingDialogues[Math.floor(Math.random() * loadingDialogues.length)];
};
