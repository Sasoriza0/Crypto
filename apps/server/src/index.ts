import 'dotenv/config';
import { createApp } from './app.js';
import { expireGameSessions } from './services/game.service.js';

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  console.log(`ShiftCrack API listening on http://localhost:${port}`);
});

// Periodic sweep of expired ACTIVE game sessions (uses the status/expiresAt index).
setInterval(() => {
  void expireGameSessions().catch((err) => console.error('Game session sweep failed:', err));
}, 60_000).unref();
