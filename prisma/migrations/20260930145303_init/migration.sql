-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'team');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('new', 'in_review', 'validated', 'discarded');

-- CreateEnum
CREATE TYPE "AdhesionModality" AS ENUM ('standard', 'hybrid');

-- CreateEnum
CREATE TYPE "WithoutManifestation" AS ENUM ('cancel', 'keep');

-- CreateEnum
CREATE TYPE "AdhesionStatus" AS ENUM ('received', 'filed', 'cancelled');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'closed');

-- CreateEnum
CREATE TYPE "RegistrationWindow" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "SessionFormat" AS ENUM ('in_person', 'online');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('registered', 'confirmed', 'present', 'absent', 'cancelled');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('house_photo', 'event_cover', 'speaker_photo');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT,
    "display_username" TEXT,
    "role" TEXT NOT NULL DEFAULT 'team',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "ban_reason" TEXT,
    "ban_expires" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "impersonated_by" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ,
    "refresh_token_expires_at" TIMESTAMPTZ,
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_rate_limits" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "last_request" BIGINT NOT NULL,

    CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "token" TEXT NOT NULL,
    "company_name" TEXT,
    "cnpj" TEXT,
    "email" TEXT,
    "note" TEXT,
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "last_opened_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "diagnosis_drafts" (
    "id" UUID NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "diagnosis_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" SERIAL NOT NULL,
    "protocol" TEXT NOT NULL,
    "invitation_token" TEXT,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company_name" TEXT,
    "cnpj" TEXT,
    "cnpj_digits" TEXT,
    "requester" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "form_version" TEXT,
    "outcome" TEXT,
    "position" TEXT,
    "certainty" TEXT,
    "urgency" TEXT,
    "confidence" TEXT,
    "requester_in_qsa" BOOLEAN,
    "payload" JSONB NOT NULL,
    "status" "ResponseStatus" NOT NULL DEFAULT 'new',
    "internal_note" TEXT,
    "handled_by_id" TEXT,
    "handled_at" TIMESTAMPTZ,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adhesions" (
    "id" SERIAL NOT NULL,
    "protocol" TEXT NOT NULL,
    "response_id" INTEGER,
    "invitation_token" TEXT,
    "accepted_at" TIMESTAMPTZ NOT NULL,
    "company_name" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "cnpj_digits" TEXT NOT NULL,
    "representative" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "representative_role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "modality" "AdhesionModality" NOT NULL,
    "without_manifestation" "WithoutManifestation",
    "wants_proposal" BOOLEAN NOT NULL DEFAULT false,
    "term_version" TEXT NOT NULL,
    "term_hash" TEXT NOT NULL,
    "origin_ip" TEXT,
    "origin_source" TEXT,
    "forwarded_chain" TEXT,
    "user_agent" TEXT,
    "payload" JSONB NOT NULL,
    "status" "AdhesionStatus" NOT NULL DEFAULT 'received',
    "internal_note" TEXT,
    "handled_by_id" TEXT,
    "handled_at" TIMESTAMPTZ,

    CONSTRAINT "adhesions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "registrations" "RegistrationWindow" NOT NULL DEFAULT 'open',
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "updated_at" TIMESTAMPTZ,
    "updated_by_id" TEXT,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_sessions" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "format" "SessionFormat" NOT NULL DEFAULT 'in_person',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "seats" INTEGER,

    CONSTRAINT "event_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" SERIAL NOT NULL,
    "protocol" TEXT NOT NULL,
    "event_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,
    "response_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "cnpj" TEXT,
    "cnpj_digits" TEXT,
    "job_title" TEXT,
    "privacy_consent" BOOLEAN NOT NULL DEFAULT false,
    "origin_ip" TEXT,
    "user_agent" TEXT,
    "payload" JSONB NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'registered',
    "internal_note" TEXT,
    "handled_by_id" TEXT,
    "handled_at" TIMESTAMPTZ,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "original_name" TEXT,
    "content_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "kind" "FileKind" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_username" TEXT,
    "action" TEXT NOT NULL,
    "reference" TEXT,
    "detail" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_hits" (
    "key" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limit_hits_pkey" PRIMARY KEY ("key","window_start")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "auth_rate_limits_key_key" ON "auth_rate_limits"("key");

-- CreateIndex
CREATE INDEX "diagnosis_drafts_expires_at_idx" ON "diagnosis_drafts"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "responses_protocol_key" ON "responses"("protocol");

-- CreateIndex
CREATE INDEX "responses_status_idx" ON "responses"("status");

-- CreateIndex
CREATE INDEX "responses_received_at_idx" ON "responses"("received_at");

-- CreateIndex
CREATE INDEX "responses_cnpj_digits_idx" ON "responses"("cnpj_digits");

-- CreateIndex
CREATE UNIQUE INDEX "adhesions_protocol_key" ON "adhesions"("protocol");

-- CreateIndex
CREATE INDEX "adhesions_accepted_at_idx" ON "adhesions"("accepted_at");

-- CreateIndex
CREATE INDEX "adhesions_status_idx" ON "adhesions"("status");

-- CreateIndex
CREATE INDEX "adhesions_modality_idx" ON "adhesions"("modality");

-- CreateIndex
CREATE INDEX "adhesions_cnpj_digits_idx" ON "adhesions"("cnpj_digits");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "event_sessions_event_id_idx" ON "event_sessions"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_protocol_key" ON "registrations"("protocol");

-- CreateIndex
CREATE INDEX "registrations_event_id_idx" ON "registrations"("event_id");

-- CreateIndex
CREATE INDEX "registrations_session_id_idx" ON "registrations"("session_id");

-- CreateIndex
CREATE INDEX "registrations_cnpj_digits_idx" ON "registrations"("cnpj_digits");

-- CreateIndex
CREATE INDEX "registrations_email_idx" ON "registrations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_key_key" ON "stored_files"("key");

-- CreateIndex
CREATE INDEX "stored_files_kind_idx" ON "stored_files"("kind");

-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "rate_limit_hits_window_start_idx" ON "rate_limit_hits"("window_start");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_invitation_token_fkey" FOREIGN KEY ("invitation_token") REFERENCES "invitations"("token") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adhesions" ADD CONSTRAINT "adhesions_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adhesions" ADD CONSTRAINT "adhesions_invitation_token_fkey" FOREIGN KEY ("invitation_token") REFERENCES "invitations"("token") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adhesions" ADD CONSTRAINT "adhesions_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_sessions" ADD CONSTRAINT "event_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "event_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "responses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "registrations_session_email_active_key"
  ON "registrations" ("session_id", lower("email"))
  WHERE "status" <> 'cancelled';

CREATE OR REPLACE FUNCTION audit_logs_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs aceita só inserção';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_changes();
