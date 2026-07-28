# Integration Gestion ISR

Cette version active un import web depuis une page de logements Gestion ISR.

Fonctionnement actuel:
- route API: POST /api/properties/import/gestion-isr
- source URL via champ formulaire ou variable GESTION_ISR_LISTINGS_URL
- extraction HTML des cartes de logements
- creation/mise a jour des logements par code ISR
- import des liens photo
- statut force a TO_VERIFY pour revision manuelle

Limites:
- l'extraction depend de la structure HTML actuelle
- si Gestion ISR modifie son site, les selecteurs devront etre ajustes

Evolution recommandee:
- connecteur officiel/API Gestion ISR avec autorisation
- import planifie (cron)
- controle de qualite des champs importes
