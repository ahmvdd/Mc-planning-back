# Tasks / bugs connus

## Bugs trouvés

- [x] **Pointage — `orgId` vs `organizationId`** (corrigé le 2026-09-16) — `pointage.controller.ts` lisait `req.user.organizationId` (champ inexistant) au lieu de `req.user.orgId` (le vrai champ signé dans le JWT). Résultat : org id toujours `undefined` sur tous les endpoints pointage (scan, checkin, génération QR, pointages du jour, pointage manuel). Corrigé dans tous les endpoints du contrôleur.
- [x] **500 sur `/planning/periods` et `/auth/signup` en prod** (corrigé le 2026-09-21) — `prisma migrate deploy` (via `preDeployCommand` sur Render) n'avait plus appliqué aucune migration depuis début février malgré des dizaines de commits derrière, ET la base avait aussi des correctifs manuels ad-hoc jamais enregistrés dans `_prisma_migrations` (`Pointage`, `RequestLog`, `PlanningEntry.planningId` existaient déjà hors migration, avec en plus une contrainte FK manquante sur `RequestLog.requestId`). Diagnostiqué et rattrapé à la main via le SQL Editor Supabase (audit table par table + colonnes + contraintes FK avant d'écrire le script, tout appliqué dans une transaction). Signup admin et `/planning/periods` fonctionnent de nouveau en prod. Cause racine de `preDeployCommand` toujours pas identifiée — à surveiller sur le prochain déploiement Render pour voir s'il applique bien les futures migrations tout seul.

## En cours

- [ ] Billing Stripe — backend fait (checkout, webhook, portail, gating employés/QR/import Excel), reste : frontend admin (bouton upgrade, bannière limite), clés Stripe réelles pour tester en bout en bout.
- [ ] Prix de lancement fixé à 2€/mois (temporaire) — à remonter une fois l'app stabilisée et les écarts ci-dessous comblés, au moins en partie.

## Pour être au niveau des concurrents (Skello, Combo, Snapshift)

Contexte : ces produits sont matures, financés, avec plusieurs années d'itération. Cette liste sert de repère, pas d'objectif "tout faire avant de facturer" — priorise selon ce qui bloque vraiment les premiers clients.

### Priorité 1 — fiabilité de base (bloquant, avant tout le reste)
- [x] Corriger le 500 sur `/planning/periods` en prod (migration manquante) — fait le 2026-09-21
- [ ] Comprendre pourquoi `preDeployCommand: npx prisma migrate deploy` ne s'exécute pas correctement sur Render (silencieux, aucune erreur visible côté déploiement) — sinon le même problème revient au prochain push de migration
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
- [x] Modèles de planning réutilisables (semaine type) — fait le 2026-09-17
- [ ] Suggestions automatiques de planning selon les disponibilités déclarées
- [x] Disponibilités employé (déclarer ses dispos, pas juste demander des congés) — fait le 2026-09-17
- [ ] Notifications push/SMS (actuellement rien, juste l'app web)

### Priorité 4 — mobile
- [ ] App mobile native iOS/Android (ou au minimum PWA installable avec notifications push) — actuellement web responsive uniquement

### Priorité 5 — confiance/support
- [ ] Page statut système public (uptime, incidents)
- [ ] Support client structuré (chat, email dédié — actuellement rien de formalisé)
- [ ] Onboarding guidé pour un nouvel admin (actuellement on arrive sur un dashboard vide sans aide)
- [ ] Vraies mentions légales/CGV à jour (vérifier `/cgu`, `/confidentialite`, `/rgpd` sont bien remplies et pas des templates)
