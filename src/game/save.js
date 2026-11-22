const KEY = 'erlenwacht.save';
const VERSION = 1;

export function openSave() {
  let storage;
  let data;
  try {
    storage = window.localStorage;
    const record = JSON.parse(storage.getItem(KEY));
    if (record?.version === VERSION) data = record;
  } catch {
    // A blocked or damaged save should still allow a new session.
  }

  return {
    data,
    write(snapshot) {
      try {
        if (!storage) return false;
        storage.setItem(KEY, JSON.stringify({ ...snapshot, version: VERSION }));
        return true;
      } catch {
        return false;
      }
    },
  };
}
