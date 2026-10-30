<script lang="ts">
  // About Keypals: what it is, who makes it, how it's made (and that its art and 3D characters are made
  // with AI tools, said plainly, as the tools' terms ask), what it's for, privacy in a line, and how to
  // get in touch. Opened from the compass menu and Grown-ups; Back goes where it was opened from.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { STUDIO_URL } from '../config';
  import { openExternal } from '../state/platform';
  import Header from '../ui/Header.svelte';

  const base = import.meta.env.BASE_URL;
  const MAIL = 'hello@keypals.org';
</script>

<div class="screen about">
  <Header />
  <div class="body scroll">
    <div class="hero" style:background-image="url({base}about/header.webp)" role="img" aria-label="Dino painting a picture in a little workshop on a sky island, with two Glimmers helping"></div>

    <div class="cols">
      <section class="card blk what">
        <h2>What Keypals is</h2>
        <p>Keypals is a typing and math game for children from 5 to 12. You learn by playing: your buddy shows you a trick, you practise it on the map, and what you earn takes you on adventures.</p>
      </section>

      <section class="card blk who">
        <h2>Who makes it</h2>
        <p><b>FancyAnt Games</b>: that's Erik Wilder, in Atlanta, Georgia, making small, friendly games for families.</p>
        <button class="btn" onclick={() => { sfx.click(); openExternal(`${STUDIO_URL}/?ref=keypals-about`); }}><img src="{base}brand/ant-mark.png" alt="" />More games at fancyant.com</button>
      </section>

      <section class="card blk how">
        <h2>How it's made</h2>
        <p>The painted pictures and the 3D characters are made with the help of AI tools (the 3D models with tools such as Tencent's Hunyuan 3D), then picked, fixed and checked by a person before they go in the game. So: the art you see in Keypals is AI-made art, looked after by people.</p>
        <p>The voices are made on our own computer with OmniVoice, an open voice model, and checked by a person. The voices are designed for Keypals, not copies of anyone's real voice.</p>
        <p class="credits">Built with Higgs Materials licensed from Boson AI USA, Inc., Copyright Boson AI USA, Inc., All Rights Reserved, and Meta Llama 3 licensed under the Meta Llama 3 Community License, Copyright Meta Platforms, Inc., All Rights Reserved (part of OmniVoice, used to make the voices).</p>
        <p>The lessons, the math and the game itself are written and tested by hand.</p>
      </section>

      <section class="card blk for">
        <h2>What it's for</h2>
        <p>Practice that feels like play: a little every day, at your own speed. No ads, nothing to buy, and shells you earn by playing are the only money in the game.</p>
      </section>

      <section class="card blk priv">
        <h2>Privacy</h2>
        <p>We keep as little as we can: a nickname and game progress, never a child's real name or email. <a href="privacy" target="_blank" rel="noopener">How we look after your information</a></p>
      </section>

      <section class="card blk mail">
        <h2>Say hello</h2>
        <p>Questions, ideas or something not working? Write to us, or ask a grown-up to.</p>
        <a class="btn btn-primary mailbtn" href="mailto:{MAIL}"><img src="{base}icons/mail.webp" alt="" />{MAIL}</a>
      </section>
    </div>
  </div>
</div>

<style>
  .about { display: flex; flex-direction: column; background: linear-gradient(#fff8ee, #fbf8ff 50%); }
  .body { flex: 1; min-height: 0; padding: 18px 24px 50px; display: flex; flex-direction: column; gap: 18px; max-width: 1180px; width: 100%; margin: 0 auto; }
  .hero { flex: none; aspect-ratio: 16 / 6; border-radius: 28px; background-size: cover; background-position: center 62%; box-shadow: 0 0 0 4px #fff, 0 20px 40px -22px rgba(80, 40, 20, .6); }
  .cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .blk { padding: 16px 20px 18px; display: flex; flex-direction: column; gap: 8px; }
  .blk h2 { margin: 0; font-size: 24px; }
  .blk p { margin: 0; font: 600 16.5px/1.5 var(--font-body); color: var(--ink2); }
  .blk p b { color: var(--ink); }
  .blk a { color: var(--primary); font-weight: 700; }
  .what { box-shadow: inset 0 0 0 3px #ddd3ff; }
  .how { box-shadow: inset 0 0 0 3px #ffe3a0; }
  .mail { box-shadow: inset 0 0 0 3px #bfe9d0; }
  .blk .btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; }
  .blk .btn img { width: 30px; height: 30px; object-fit: contain; border-radius: 50%; }
  .mailbtn { text-decoration: none; color: #fff !important; }
  .mailbtn img { border-radius: 0 !important; }
  @media (max-width: 760px) {
    .body { padding: 12px 12px 40px; gap: 12px; }
    .hero { aspect-ratio: 16 / 9; border-radius: 20px; }
    .cols { grid-template-columns: 1fr; gap: 12px; }
    .blk { padding: 14px 16px; }
    .blk h2 { font-size: 21px; }
    .blk p { font-size: 15.5px; }
  }
  .credits { font-size: 12px; color: #8a7aa8; line-height: 1.45; }
</style>
