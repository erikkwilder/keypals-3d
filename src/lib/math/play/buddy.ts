// What a playground game can ask of your 3D buddy: where it stands on the screen, and what it does.
export type PlayBuddy = {
  /** the box on screen the buddy stands in (a wide number line, or a small corner), metres across it,
   *  and where its feet go (0 the box's top, 1 its bottom) */
  area(el: HTMLElement | null, opts?: { span?: number; feetAt?: number }): void;
  /** hop to a spot across the screen (a fraction of the window's width); `now` puts it there at once */
  hop(sx: number, now?: boolean): void;
  cheer(): void;
  oops(): void;
};
