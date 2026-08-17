import { describe, expect, it } from "vitest";
import { normalizePost, stripChannelAds, stripUnsupportedSymbols } from "../normalize";

describe("stripUnsupportedSymbols", () => {
  it("removes joiners, variation selectors and invisible markers", () => {
    const text = "Рост 👨‍👩‍👧 💪️ новости. Скрытый\u200bсимвол";
    expect(stripUnsupportedSymbols(text)).toBe("Рост 👨👩👧 💪 новости. Скрытыйсимвол");
  });

  it("removes flags, skin tones and keycaps but keeps plain emoji", () => {
    const text = "Россия 🇷🇺 победа, число 1️⃣, привет 🖐🏽 и котик 🐱";
    expect(stripUnsupportedSymbols(text)).toBe("Россия победа, число 1, привет 🖐 и котик 🐱");
  });

  it("collapses extra spaces and blank lines", () => {
    expect(stripUnsupportedSymbols("Много   пробелов\n\n\n\nи пустых строк")).toBe(
      "Много пробелов\n\nи пустых строк",
    );
  });
});

describe("stripChannelAds", () => {
  it("removes whole promo lines from the end of a post", () => {
    const text = "Срочно: крупное отключение света в Алма-Ате.\n\nПодписывайтесь на наш канал в MAX";
    expect(stripChannelAds(text)).toBe("Срочно: крупное отключение света в Алма-Ате.");
  });

  it("removes promo lines regardless of leading emoji/symbols", () => {
    const text = "Новость дня.\n\n👉 Подписывайтесь на наш канал: @bbbreaking\n✈️ Больше новостей — на нашем канале";
    expect(stripChannelAds(text)).toBe("Новость дня.");
  });

  it("strips an inline CTA suffix glued to the news line", () => {
    const text = "Цена на биткоин обновила максимум. Подписывайтесь на наш канал: @x";
    expect(stripChannelAds(text)).toBe("Цена на биткоин обновила максимум.");
  });

  it("keeps legitimate news text untouched", () => {
    const text = "Путин подписал закон о налогах.\nЧитайте также: как это скажется на рынке.";
    expect(stripChannelAds(text)).toBe(text);
  });

  it("keeps a source phrase that is not a call-to-action", () => {
    const text = "Больше новостей вы найдёте в разделе экономики.";
    expect(stripChannelAds(text)).toBe(text);
  });

  it("handles English promos", () => {
    const text = "Breaking news.\n\nSubscribe to our channel for updates\nFollow us for more";
    expect(stripChannelAds(text)).toBe("Breaking news.");
  });

  it("removes «Больше … — в нашем канале в «Максе»» promo lines", () => {
    const text = "Обломки задели стену склада.\n\n🐚 Больше инфографики — в нашем канале в «Максе».";
    expect(stripChannelAds(text)).toBe("Обломки задели стену склада.");
  });

  it("removes «Больше новостных дайджестов» promo lines", () => {
    const text = "Главные новости к этому часу.\n\n🐚 Больше новостных дайджестов — в нашем канале в «Максе».";
    expect(stripChannelAds(text)).toBe("Главные новости к этому часу.");
  });

  it("strips inline «Канал РБК в Максе» promos glued to the news line", () => {
    const text = "Рекордные 50,8% импорта. ▪️Канал РБК в «Максе» ▪️Приложение РБК для iOS и Android";
    expect(stripChannelAds(text)).toBe("Рекордные 50,8% импорта.");
  });

  it("strips branded «Подписывайся на Readovka в МАКС» promos", () => {
    const text = "Посетители перестали ходить на пляжи. 🎉 Подписывайся на Readovka в МАКС";
    expect(stripChannelAds(text)).toBe("Посетители перестали ходить на пляжи.");
  });

  it("strips «Подписаться на URA.RU | мы в MAКС» promos", () => {
    const text = "Площадь пожаров превысила 205 тыс. га. 🌐 Подписаться на URA.RU | мы в MAКС";
    expect(stripChannelAds(text)).toBe("Площадь пожаров превысила 205 тыс. га.");
  });

  it("strips «Читайте нас в MAX» promos", () => {
    const text = "Не грузятся фото и видео? ❗ Читайте нас в MAX";
    expect(stripChannelAds(text)).toBe("Не грузятся фото и видео?");
  });

  it("strips «Если у вас не загружается видео, его можно посмотреть в «Максе»» promos", () => {
    const text =
      "Крупнейший в истории Бельгии пожар охватил более 3 тыс. гектаров земли.\n\n🐚 Если у вас не загружается видео, его можно посмотреть в «Максе».";
    expect(stripChannelAds(text)).toBe("Крупнейший в истории Бельгии пожар охватил более 3 тыс. гектаров земли.");
  });

  it("strips inline «если не загружается видео… в MAX» promos", () => {
    const text = "Агентство отмечает, что площадь возгорания более чем вдвое превышает площадь пожара. Если у вас не загружается видео, его можно посмотреть в MAX.";
    expect(stripChannelAds(text)).toBe("Агентство отмечает, что площадь возгорания более чем вдвое превышает площадь пожара.");
  });

  it("strips «Реклама в канале» and «Вакансии:» lines", () => {
    const text = "Совет директоров утвердил отчёт.\n\nРеклама в канале\nВакансии: пишите на job@example.com";
    expect(stripChannelAds(text)).toBe("Совет директоров утвердил отчёт.");
  });

  it("strips engagement CTAs like «Поставь реакцию»", () => {
    const text = "Цены на нефть выросли.\n\nПоставь реакцию и поделись постом!";
    expect(stripChannelAds(text)).toBe("Цены на нефть выросли.");
  });

  it("strips cross-channel «Читайте также в нашем канале» but keeps editorial cross-references", () => {
    const text = "Парламент принял закон.\n\nЧитайте также в нашем канале разбор.\nЧитайте также: как это скажется на рынке.";
    expect(stripChannelAds(text)).toBe("Парламент принял закон.\n\nЧитайте также: как это скажется на рынке.");
  });

  it("strips «Наш Telegram: @x» contact lines and English promo lines", () => {
    const text = "Главное к часу.\n\nНаш Telegram: @news_for_adults\nFor advertising: promo@x.io\nContact us";
    expect(stripChannelAds(text)).toBe("Главное к часу.");
  });

  it("strips a trailing engagement CTA glued to the news line", () => {
    const text = "Погода резко испортилась на юге страны. Поставь реакцию";
    expect(stripChannelAds(text)).toBe("Погода резко испортилась на юге страны.");
  });
});

describe("normalizePost", () => {
  it("derives clean text, normalized text and links after ad stripping", () => {
    const out = normalizePost({
      text: "Главное: курс доллара упал.\n\nПодписывайтесь на наш канал: @fx\nПодробности на https://example.com/news",
      views: 42,
    });
    expect(out.text).toBe("Главное: курс доллара упал.\n\nПодробности на https://example.com/news");
    expect(out.links).toContain("https://example.com/news");
    expect(out.links).not.toContain("подписывайтесь");
  });

  it("strips unsupported symbols from post text and media captions", () => {
    const out = normalizePost({
      text: "Победа 🇷🇺 зафиксирована. Смотрим 1️⃣ 🖐🏽",
      media: [{ kind: "PHOTO", remoteId: "p", mimeType: null, width: null, height: null, duration: null, caption: "Столица 🏙️‍✨ в тумане" }],
    });
    expect(out.text).toBe("Победа зафиксирована. Смотрим 1 🖐");
    expect(out.mediaCaption).toBe("Столица 🏙✨ в тумане");
  });

  it("keeps plain emoji in post text", () => {
    const out = normalizePost({ text: "Котик 🐱 смотрит на закат 🌅" });
    expect(out.text).toBe("Котик 🐱 смотрит на закат 🌅");
  });

  it("decodes numeric HTML entities left in post text", () => {
    const out = normalizePost({ text: "Инвестиции составили &#036;109,5 млн и &#x27;направлены&#x27; в фонды" });
    expect(out.text).toContain("$109,5 млн");
    expect(out.text).not.toContain("&#");
  });
});