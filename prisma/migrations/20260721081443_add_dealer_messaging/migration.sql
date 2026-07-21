-- CreateEnum
CREATE TYPE "public"."ConversationContext" AS ENUM ('GENERAL', 'TRANSPORT');

-- CreateTable
CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "businessAId" TEXT NOT NULL,
    "businessBId" TEXT NOT NULL,
    "contextType" "public"."ConversationContext" NOT NULL DEFAULT 'GENERAL',
    "contextId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DealerMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderBusinessId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_businessAId_lastMessageAt_idx" ON "public"."Conversation"("businessAId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_businessBId_lastMessageAt_idx" ON "public"."Conversation"("businessBId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_businessAId_businessBId_contextType_contextId_key" ON "public"."Conversation"("businessAId", "businessBId", "contextType", "contextId");

-- CreateIndex
CREATE INDEX "DealerMessage_conversationId_createdAt_idx" ON "public"."DealerMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_businessAId_fkey" FOREIGN KEY ("businessAId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_businessBId_fkey" FOREIGN KEY ("businessBId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DealerMessage" ADD CONSTRAINT "DealerMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DealerMessage" ADD CONSTRAINT "DealerMessage_senderBusinessId_fkey" FOREIGN KEY ("senderBusinessId") REFERENCES "public"."Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
