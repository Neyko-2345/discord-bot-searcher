export const name = 'ready';
export const once = true;

export async function execute(client) {
  console.log(`[BOT] Connecté en tant que ${client.user.tag}`);
  client.user.setActivity('🔍 Recherche de données', { type: 3 });
}
