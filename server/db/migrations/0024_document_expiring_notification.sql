-- US-15.6: Add document_expiring notification type
-- This migration adds a new notification type for document expiry alerts

ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'document_expiring';
