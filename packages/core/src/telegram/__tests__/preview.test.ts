import { describe, expect, it } from "vitest";
import { parseChannelMessages, parsePreviewViews } from "../preview";

const PAGE = `<!DOCTYPE html>
<html><head><title>Новости дня — Telegram</title></head>
<body>
<div class="tgme_page">
  <div class="tgme_page_title"><span>Новости дня</span></div>
</div>

<div class="tgme_widget_message" data-post="news_today/1234">
  <div class="tgme_widget_message_info">
    <span class="tgme_widget_message_views">1.2K</span>
    <time datetime="2026-08-14T09:10:00+00:00"></time>
  </div>
  <div class="tgme_widget_message_text">Срочно: <b>погода</b> улучшается<br>во всех регионах &amp; городах</div>
</div>

<div class="tgme_widget_message" data-post="news_today/1235">
  <div class="tgme_widget_message_info">
    <span class="tgme_widget_message_views">3</span>
    <time datetime="2026-08-14T09:20:00+00:00"></time>
  </div>
  <div class="tgme_widget_message_photo_wrap">
    <a class="tgme_widget_message_photo" style="background-image:url('https://cdn.example/file/photo_1.jpg')"></a>
  </div>
  <div class="tgme_widget_message_text">Фото дня</div>
</div>

<div class="tgme_widget_message tgme_widget_message_service_message">
  <div class="tgme_widget_message_info"><time datetime="2026-08-14T00:00:00+00:00"></time></div>
  <div class="tgme_widget_message_service"><div class="tgme_widget_message_bubble">Joined channel</div></div>
</div>

<div class="tgme_widget_message" data-post="news_today/1236">
  <div class="tgme_widget_message_info">
    <time datetime="2026-08-14T09:30:00+00:00"></time>
  </div>
  <div class="tgme_widget_message_text">Без просмотров</div>
</div>
</body></html>`;

describe("parseChannelMessages", () => {
  it("extracts text, views and dates from public preview HTML", () => {
    const posts = parseChannelMessages(PAGE);
    expect(posts).toHaveLength(3);
    const [first] = posts;
    expect(first!.id).toBe(1234);
    expect(first!.text).toBe("Срочно: погода улучшается\nво всех регионах & городах");
    expect(first!.views).toBe(1200);
    expect(first!.date).toBe("2026-08-14T09:10:00+00:00");
    expect(first!.hasPhoto).toBe(false);
    expect(first!.photoUrl).toBeNull();
  });

  it("decodes &nbsp; entities into regular spaces", () => {
    const html = `<div class="tgme_widget_message" data-post="news_today/9001">
      <div class="tgme_widget_message_info"><time datetime="2026-08-14T09:10:00+00:00"></time></div>
      <div class="tgme_widget_message_text">Доля России&nbsp;в импорте нефти</div>
    </div>`;
    const [post] = parseChannelMessages(html);
    expect(post!.text).toBe("Доля России в импорте нефти");
  });

  it("captures photo posts with the media URL", () => {
    const posts = parseChannelMessages(PAGE);
    expect(posts[1]!.id).toBe(1235);
    expect(posts[1]!.hasPhoto).toBe(true);
    expect(posts[1]!.photoUrl).toBe("https://cdn.example/file/photo_1.jpg");
  });

  it("captures photos from the current photo_wrap markup (href between class and style)", () => {
    const html = `<div class="tgme_widget_message" data-post="news_today/777">
      <a class="tgme_widget_message_photo_wrap 5472161160200134365 1274086805_460005085" href="https://t.me/news_today/777" style="width:640px;background-image:url('https://cdn.example/file/photo_2.jpg')">
        <div class="tgme_widget_message_photo" style="padding-top:125%"></div>
      </a>
      <div class="tgme_widget_message_text">Фото в новом формате</div>
    </div>`;
    const [post] = parseChannelMessages(html);
    expect(post!.hasPhoto).toBe(true);
    expect(post!.photoUrl).toBe("https://cdn.example/file/photo_2.jpg");
  });

  it("skips service messages and leaves views null when absent", () => {
    const posts = parseChannelMessages(PAGE);
    expect(posts[2]!.id).toBe(1236);
    expect(posts[2]!.views).toBeNull();
    expect(posts.find((p) => p.id === 1235 && p.text === "Joined channel")).toBeUndefined();
  });

  it("uses the visible <time datetime> as the per-message date", () => {
    const withTime = `<div class="tgme_widget_message" data-post="news_today/9999" data-view="eyJ0IjoxNzg2NzEwNjkxfQ">
      <div class="tgme_widget_message_info"><time datetime="2026-08-13T08:00:00+00:00"></time></div>
      <div class="tgme_widget_message_text">Дата из time</div>
    </div>`;
    const [post] = parseChannelMessages(withTime);
    expect(post!.id).toBe(9999);
    expect(post!.date).toBe("2026-08-13T08:00:00+00:00");
  });

  it("ignores the data-view token (page render time) and leaves date null without <time>", () => {
    const onlyDataView = `<div class="tgme_widget_message" data-post="news_today/9998" data-view="eyJ0IjoxNzg2NzEwNjkxfQ">
      <div class="tgme_widget_message_text">Только data-view</div>
    </div>`;
    const [post] = parseChannelMessages(onlyDataView);
    expect(post!.date).toBeNull();
  });
});

describe("parsePreviewViews", () => {
  it("parses K/M suffixes and plain numbers", () => {
    expect(parsePreviewViews("1.2K")).toBe(1200);
    expect(parsePreviewViews("3")).toBe(3);
    expect(parsePreviewViews("1 234")).toBe(1234);
    expect(parsePreviewViews("2,5M")).toBe(2500000);
  });

  it("returns null for garbage", () => {
    expect(parsePreviewViews("")).toBeNull();
    expect(parsePreviewViews("abc")).toBeNull();
  });
});