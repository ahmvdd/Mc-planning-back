const REQUIRED_ENV = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Variables d'environnement manquantes au démarrage : ${missing.join(', ')}. ` +
      `L'app refuse de démarrer sans secrets JWT explicites (pas de valeur par défaut en dur).`,
  );
}
