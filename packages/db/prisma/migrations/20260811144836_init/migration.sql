-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SessionPurpose" AS ENUM ('WEB');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('ACTIVE', 'VALIDATING', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('NEW', 'NORMALIZED', 'CLUSTERED', 'DUPLICATE', 'REJECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'VIDEO', 'ANIMATION', 'DOCUMENT', 'AUDIO');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'ACCEPTED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EditionKind" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "EditionStatus" AS ENUM ('GENERATED', 'FAILED');

-- CreateEnum
CREATE TYPE "ArticleFormat" AS ENUM ('MAJOR', 'STANDARD', 'BRIEF', 'FUNNY', 'URGENT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "language" TEXT NOT NULL DEFAULT 'ru',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "SessionPurpose" NOT NULL DEFAULT 'WEB',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "importanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "telegramUsername" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "avatarPath" TEXT,
    "avatarUrl" TEXT,
    "categoryId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "isDefaultSource" BOOLEAN NOT NULL DEFAULT false,
    "status" "ChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "priorityOverride" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramPost" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "telegramMessageId" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "normalizedText" TEXT NOT NULL DEFAULT '',
    "language" TEXT,
    "contentHash" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'NEW',
    "isForwarded" BOOLEAN NOT NULL DEFAULT false,
    "forwardedFrom" TEXT,
    "views" INTEGER,
    "reactions" JSONB,
    "mediaCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "adScore" DOUBLE PRECISION,
    "spamScore" DOUBLE PRECISION,
    "importance" INTEGER,
    "sentiment" DOUBLE PRECISION,
    "sentimentLabel" TEXT,
    "keywordTags" JSONB,

    CONSTRAINT "TelegramPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "telegramPostId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "remoteId" TEXT,
    "localPath" TEXT,
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "caption" TEXT,
    "attribution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT,
    "headline" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "longForm" TEXT NOT NULL DEFAULT '',
    "generatedLanguage" TEXT NOT NULL DEFAULT 'ru',
    "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT',
    "importance" INTEGER NOT NULL DEFAULT 0,
    "sentiment" DOUBLE PRECISION,
    "urgency" BOOLEAN NOT NULL DEFAULT false,
    "isFunny" BOOLEAN NOT NULL DEFAULT false,
    "isUncertain" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "clusterHash" TEXT,
    "sourcesCount" INTEGER NOT NULL DEFAULT 1,
    "primaryPostId" TEXT,
    "firstPostAt" TIMESTAMP(3),
    "lastPostAt" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "aiInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryPost" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "telegramPostId" TEXT NOT NULL,
    "contribution" TEXT NOT NULL DEFAULT 'supporting',

    CONSTRAINT "StoryPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL,
    "kind" "EditionKind" NOT NULL,
    "editionDate" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "publishedAt" TIMESTAMP(3),
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "configSnapshot" JSONB,
    "status" "EditionStatus" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "storyId" TEXT,
    "page" INTEGER NOT NULL,
    "pageOrder" INTEGER NOT NULL DEFAULT 0,
    "section" TEXT NOT NULL,
    "sectionIndex" INTEGER NOT NULL DEFAULT 0,
    "format" "ArticleFormat" NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "imageMediaId" TEXT,
    "headlineOverride" TEXT,
    "summaryOverride" TEXT,
    "bodyOverride" TEXT,
    "manuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isUncertain" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB,
    "aiInfo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleSource" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "telegramPostId" TEXT,
    "channelName" TEXT NOT NULL,
    "channelUsername" TEXT NOT NULL,
    "messageId" INTEGER,
    "url" TEXT,

    CONSTRAINT "ArticleSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ru',
    "enabledCategoryKeys" JSONB,
    "humorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contentAmount" TEXT NOT NULL DEFAULT 'normal',
    "geographicFocus" TEXT,
    "myNewspaperEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resultKey" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_key_key" ON "Category"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_enabled_sortOrder_idx" ON "Category"("enabled", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_telegramUsername_key" ON "Channel"("telegramUsername");

-- CreateIndex
CREATE INDEX "Channel_enabled_priority_idx" ON "Channel"("enabled", "priority");

-- CreateIndex
CREATE INDEX "Channel_isDefaultSource_idx" ON "Channel"("isDefaultSource");

-- CreateIndex
CREATE INDEX "ChannelSubscription_channelId_idx" ON "ChannelSubscription"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelSubscription_userId_channelId_key" ON "ChannelSubscription"("userId", "channelId");

-- CreateIndex
CREATE INDEX "TelegramPost_contentHash_idx" ON "TelegramPost"("contentHash");

-- CreateIndex
CREATE INDEX "TelegramPost_status_fetchedAt_idx" ON "TelegramPost"("status", "fetchedAt");

-- CreateIndex
CREATE INDEX "TelegramPost_publishedAt_idx" ON "TelegramPost"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramPost_channelId_telegramMessageId_key" ON "TelegramPost"("channelId", "telegramMessageId");

-- CreateIndex
CREATE INDEX "Media_telegramPostId_idx" ON "Media"("telegramPostId");

-- CreateIndex
CREATE UNIQUE INDEX "Story_clusterHash_key" ON "Story"("clusterHash");

-- CreateIndex
CREATE INDEX "Story_status_importance_idx" ON "Story"("status", "importance");

-- CreateIndex
CREATE INDEX "Story_createdAt_idx" ON "Story"("createdAt");

-- CreateIndex
CREATE INDEX "StoryPost_telegramPostId_idx" ON "StoryPost"("telegramPostId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryPost_storyId_telegramPostId_key" ON "StoryPost"("storyId", "telegramPostId");

-- CreateIndex
CREATE INDEX "Edition_editionDate_idx" ON "Edition"("editionDate");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_kind_editionDate_key" ON "Edition"("kind", "editionDate");

-- CreateIndex
CREATE INDEX "Article_editionId_page_idx" ON "Article"("editionId", "page");

-- CreateIndex
CREATE INDEX "Article_section_idx" ON "Article"("section");

-- CreateIndex
CREATE INDEX "ArticleSource_articleId_idx" ON "ArticleSource"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingJob_resultKey_key" ON "ProcessingJob"("resultKey");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_createdAt_idx" ON "ProcessingJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProcessingJob_type_idx" ON "ProcessingJob"("type");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSubscription" ADD CONSTRAINT "ChannelSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSubscription" ADD CONSTRAINT "ChannelSubscription_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramPost" ADD CONSTRAINT "TelegramPost_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_telegramPostId_fkey" FOREIGN KEY ("telegramPostId") REFERENCES "TelegramPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_primaryPostId_fkey" FOREIGN KEY ("primaryPostId") REFERENCES "TelegramPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryPost" ADD CONSTRAINT "StoryPost_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryPost" ADD CONSTRAINT "StoryPost_telegramPostId_fkey" FOREIGN KEY ("telegramPostId") REFERENCES "TelegramPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSource" ADD CONSTRAINT "ArticleSource_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
