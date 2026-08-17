/**
 * Keyword lexicons for deterministic classification (RU + EN). Single tokens;
 * matching is case-insensitive over tokenized text.
 */

export type Lexicon = Record<string, string[]>;

export const CATEGORY_KEYWORDS: Lexicon = {
  main: ["новость", "сводка", "главное", "итоги", "dayli", "breaking", "top", "обзор"],
  world: ["мир", "world", "международный", "саммит", "переговоры", "оон", "сша", "китай", "нато", "санкции"],
  europe: ["евросоюз", "еи", "европа", "брюссель", "франция", "германия", "польша", "европарламент"],
  russia: ["россия", "путин", "госдума", "кремль", "минфин", "мвд", "регионы", "москва"],
  tech: ["технологии", "смартфон", "разработка", "ии", "нейросеть", "обновление", "гаджет", "приложение", "сервис", "tech", "ai", "app", "software", "чип"],
  science: ["учёные", "наука", "исследование", "космос", "спутник", "марс", "физики", "лекарство", "ген", "science", "study", "space", "космический"],
  business: ["рынок", "экономика", "акции", "курс", "биткоин", "криптовалюта", "прибыль", "инвестиции", "компания", "bank", "market", "stock", "rub", "доллар"],
  games: ["игра", "анонс", "геймпад", "steam", "консоль", "обновление игры", "киберспорт", "game", "игровой"],
  sports: ["спорт", "матч", "футбол", "хоккей", "турнир", "гол", "команда", "олимпиада", "sport", "match", "goal"],
  culture: ["культура", "фильм", "сериал", "театр", "выставка", "книга", "музыка", "альбом", "фестиваль", "movie", "film", "album"],
  humor: ["шутка", "мем", "прикол", "смешное", "забавный", "смех", "funny", "meme", "lol", "кот", "котлета"],
};

export const URGENT_MARKERS = [
  "срочно",
  "экстренно",
  "только что",
  "прямой эфир",
  "breaking",
  "just in",
  "emergency",
  "live update",
  "взрыв",
];

export const SPAM_AD_MARKERS = [
  "скидка",
  "распродажа",
  "выиграй",
  "промокод",
  "казино",
  "заработок",
  "инвестиции в",
  "пассивный доход",
  "сигнал",
  "vip-доступ",
  "реферальная",
  "бесплатно подпи",
  "получи бонус",
  "никакой магии",
  "discount",
  "free money",
  "cashback",
  "casino",
  "win cash",
  "crypto boost",
  "guaranteed",
  "limited offer",
];

export const HUMOR_AREA_MARKERS = [
  "кот",
  "мем",
  "прикол",
  "шутка",
  "смешно",
  "ржак",
  "funny",
  "meme",
  "курьёз",
  "необычный случай",
  "животное",
];

/** Very short posts / meaningless fragments (icons, "❯❯", isolated links). */
export function looksEmpty(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return true;
  // only punctuation / emoji / repeated chars
  const meaningful = t.replace(/[\p{P}\p{S}\s\d]/gu, "");
  return meaningful.length < 3;
}

export const WORD_BOUNDARY = /[\p{L}\p{N}']+/gu;