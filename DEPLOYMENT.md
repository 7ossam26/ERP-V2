# Deployment

## Target Infrastructure

**Dokploy on Hostinger VPS** — configured in Phase 8.

## Planned Stack

- VPS: Hostinger (Ubuntu)
- Orchestrator: Dokploy
- Database: MySQL (managed container or hosted)
- Backend: Node.js/Express container
- Frontend: Nginx static container (built Vite output)
- Domain: `RAMEX_PROD_HOST` (set real value in Phase 8)

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for required variables.

## Notes

- Set `NODE_ENV=production` in backend container
- Set `RAMEX_PROD_HOST` to the real domain
- Run `npm run seed:ramex` once after first deploy (or set `RUN_SEED=true`)
- SSL termination via Dokploy reverse proxy
