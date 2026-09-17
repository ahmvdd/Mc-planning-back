# Tasks / bugs connus

## Bugs trouvés

- [x] **Pointage — `orgId` vs `organizationId`** (corrigé le 2026-09-16) — `pointage.controller.ts` lisait `req.user.organizationId` (champ inexistant) au lieu de `req.user.orgId` (le vrai champ signé dans le JWT). Résultat : org id toujours `undefined` sur tous les endpoints pointage (scan, checkin, génération QR, pointages du jour, pointage manuel). Corrigé dans tous les endpoints du contrôleur.
- [ ] **500 sur `/planning/periods` en prod** — la base de prod (Supabase) n'a probablement pas la migration `Planning`/périodes appliquée. Bloqué en attente de la connexion directe (port 5432, pas le pooler 6543) pour lancer `prisma migrate deploy`.

## En cours

- [ ] Billing Stripe — backend fait (checkout, webhook, portail, gating employés/QR/import Excel), reste : frontend admin (bouton upgrade, bannière limite), clés Stripe réelles pour tester en bout en bout.
- [ ] Prix de lancement fixé à 2€/mois (temporaire) — à remonter une fois l'app stabilisée et les écarts ci-dessous comblés, au moins en partie.

## Pour être au niveau des concurrents (Skello, Combo, Snapshift)

Contexte : ces produits sont matures, financés, avec plusieurs années d'itération. Cette liste sert de repère, pas d'objectif "tout faire avant de facturer" — priorise selon ce qui bloque vraiment les premiers clients.

### Priorité 1 — fiabilité de base (bloquant, avant tout le reste)
- [ ] Corriger le 500 sur `/planning/periods` en prod (migration manquante)
- [ ] Vérifier qu'il n'y a pas d'autres écarts de schéma entre prod et local (audit complet migration par migration)
- [ ] Mettre en place un vrai monitoring d'erreurs (Sentry ou équivalent) — actuellement les bugs (comme celui du pointage) ne sont trouvés qu'en testant manuellement
- [ ] Tests automatisés minimum sur les flux critiques (créer planning, pointer, inviter un employé) — zéro test actuellement, chaque changement peut recasser silencieusement
- [ ] Déploiement fiable (auto-deploy vérifié, pas de dérive entre commits et prod comme on l'a vu)

### Priorité 2 — conformité légale française (différenciant fort pour ce marché)
- [ ] Alertes durée max de travail (10h/jour, 48h/semaine en général)
- [ ] Alertes temps de repos obligatoire entre deux créneaux (11h consécutives)
- [ ] Gestion des heures de nuit / dimanche / jours fériés (majorations)
- [ ] Export compatible logiciel de paie (format Silae, PayFit ou CSV standard à minima)

### Priorité 3 — fonctionnalités produit attendues
- [ ] Gestion multi-sites (une organisation avec plusieurs lieux de travail, plannings séparés)
- [ ] Planning en glisser-déposer (actuellement formulaire uniquement)
- [ ] Modèles de planning réutilisables (semaine type)
- [ ] Suggestions automatiques de planning selon les disponibilités déclarées
- [ ] Disponibilités employé (déclarer ses dispos, pas juste demander des congés)
- [ ] Notifications push/SMS (actuellement rien, juste l'app web)

### Priorité 4 — mobile
- [ ] App mobile native iOS/Android (ou au minimum PWA installable avec notifications push) — actuellement web responsive uniquement

### Priorité 5 — confiance/support
- [ ] Page statut système public (uptime, incidents)
- [ ] Support client structuré (chat, email dédié — actuellement rien de formalisé)
- [ ] Onboarding guidé pour un nouvel admin (actuellement on arrive sur un dashboard vide sans aide)
- [ ] Vraies mentions légales/CGV à jour (vérifier `/cgu`, `/confidentialite`, `/rgpd` sont bien remplies et pas des templates)
