<script lang="ts">
  type Name = 'sticker' | 'hanger' | 'gear' | 'lock' | 'flag' | 'book' | 'bulb' | 'target' | 'clock' | 'pencil' | 'play' | 'back' | 'home' | 'music' | 'sound' | 'keyboard' | 'hand' | 'trophy' | 'close' | 'check' | 'replay' | 'next' | 'user' | 'download' | 'upload' | 'trash' | 'map';
  type Props = { name: Name; size?: number };
  let { name, size = 22 }: Props = $props();
  const P: Record<Name, string> = {
    sticker: '<path d="M5 4h10l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 1-2z"/><path d="M15 4v5h5"/><circle cx="10" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><path d="M9.5 15.5q2.5 2 5 0"/>',
    hanger: '<path d="M12 7a2 2 0 1 1 2-2"/><path d="M12 7v2l9 7a1.5 1.5 0 0 1-1 2.6H4a1.5 1.5 0 0 1-1-2.6l9-7"/>',
    gear: '<path d="M10.3 3h3.4l.5 2.6 1.7.9 2.4-1.2 2.4 2.4-1.2 2.4.9 1.7 2.6.5v3.4l-2.6.5-.9 1.7 1.2 2.4-2.4 2.4-2.4-1.2-1.7.9-.5 2.6h-3.4l-.5-2.6-1.7-.9-2.4 1.2-2.4-2.4 1.2-2.4-.9-1.7L3 13.7v-3.4l2.6-.5.9-1.7-1.2-2.4 2.4-2.4 2.4 1.2 1.7-.9z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    flag: '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>',
    pencil: '<path d="M4 20l1.2-4.8L16 4.4a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8L8.8 18.8z"/><path d="M14 6.5l3.5 3.5"/>',
    play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
    back: '<path d="M14.5 5l-7 7 7 7"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 14h9"/>',
    hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-.5a6 6 0 0 1-5-2.7L3 15.5a1.6 1.6 0 0 1 2.5-2L8 15"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20h7M10 17h4"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    replay: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/>',
    next: '<path d="M5 12h13M13 6l6 6-6 6"/>',
    user: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    map: '<path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z"/><path d="M9 4.5v13M15 6.5v13"/>',
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">{@html P[name]}</svg>
