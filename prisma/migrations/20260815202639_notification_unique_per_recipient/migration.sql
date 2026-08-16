-- CreateIndex
CREATE UNIQUE INDEX "Notification_companyId_type_entityType_entityId_userId_key" ON "Notification"("companyId", "type", "entityType", "entityId", "userId");
