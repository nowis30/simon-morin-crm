-- Ajoute tokenVersion au modèle User : permet d'invalider toutes les sessions
-- existantes lors d'un changement de mot de passe (I3).
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
