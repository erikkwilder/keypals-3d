// Small helpers for the browser.

export async function openExternal(url: string) {
  window.open(url, '_blank', 'noopener');
}

/** Save a text file as a download. */
export async function saveTextFile(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}
