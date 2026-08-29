/**
 * Environment de produção (default).
 *
 * Usado por `ng build` (config `production`) — inclusive nos deploys da Vercel.
 * Para desenvolvimento local o Angular substitui este arquivo por
 * `environment.development.ts` via `fileReplacements` (ver angular.json).
 */
export const environment = {
  production: true,
  apiUrl: 'https://sigaa-ufrpe-api-production.up.railway.app',
};
