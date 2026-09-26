/* Identity belongs to THIEPN Account. No tokens or credentials enter game storage. */
(function (root) {
  'use strict';
  function create({ onChange, loadSDK = () => import('/account-platform/sdk/v1/index.js') }) {
    let account, subscription, starting, generation = 0;
    async function start() {
      if (starting) return starting;
      starting = (async () => {
        try {
          if (!account) {
            const sdk = await loadSDK();
            account = sdk.createThiepnAccount({ createClient: root.supabase.createClient, appSlug: 'wttn', redirectTo: new URL('./', root.location.href).href });
            subscription = account.onAuthStateChange(({ event, session }) => {
              // Never await Supabase work from inside its auth lock callback.
              const ticket = ++generation;
              setTimeout(() => { if (ticket === generation) onChange({ status: session?.user ? 'signed-in' : 'guest', user: session?.user || null, event, account }); }, 0);
            });
          }
          const ticket = generation, session = await account.getSession();
          if (ticket === generation) onChange({ status: session?.user ? 'signed-in' : 'guest', user: session?.user || null, account });
        } catch (error) {
          onChange({ status: 'unavailable', category: account?.classifyError(error) || 'network', account });
        }
      })().finally(() => { starting = null; });
      return starting;
    }
    return { start, get account() { return account; }, destroy() { generation++; subscription?.unsubscribe(); } };
  }
  root.WTTNAccount = { create };
})(globalThis);
