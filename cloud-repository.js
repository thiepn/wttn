(function (root, factory) {
  const api = factory(); if (typeof module === 'object') module.exports = api; root.WTTNCloudRepository = api;
})(globalThis, function () {
  'use strict';
  function create(client) {
    async function rpc(name, args = {}) {
      const { data, error } = await client.rpc(name, args);
      if (error) throw error;
      return data;
    }
    return {
      read: () => rpc('wttn_read_save'),
      write: ({ snapshot, revision, requestId, checkpoint = false, restore = false }) => rpc('wttn_write_save', {
        p_snapshot: snapshot, p_revision: revision, p_request_id: requestId, p_checkpoint: checkpoint, p_restore: restore
      }),
      remove: ({ revision, requestId }) => rpc('wttn_delete_save', { p_revision: revision, p_request_id: requestId }),
      history: () => rpc('wttn_save_history')
    };
  }
  return { create };
});
