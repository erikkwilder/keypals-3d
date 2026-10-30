<script lang="ts">
  // A printed login card for one student: their name, the class code, their two pictures in order, a QR
  // code that opens the class login with the code filled in, and three short steps. Mostly white with a
  // dashed edge to cut along, so it prints well in black and white too.
  import { classUrl, classUrlShort, showClassCode } from '../names';
  import PicturePass from './PicturePass.svelte';
  import QrCode from './QrCode.svelte';
  type Props = { name: string; pics: number[]; code: string; className: string; teacher: string };
  let { name, pics, code, className, teacher }: Props = $props();
</script>

<div class="lc">
  <div class="top">
    <div>
      <p class="kp">Keypals · {className}</p>
      <h3>{name}</h3>
      <p class="t">{teacher}'s class</p>
    </div>
    <QrCode text={classUrl(code)} size={92} label="Scan to log in" />
  </div>
  <div class="code"><span>Class code</span><b>{showClassCode(code)}</b></div>
  <div class="pw"><span>My pictures, in order</span><PicturePass {pics} size={50} /></div>
  <ol>
    <li>Go to <b>{classUrlShort(code).replace(/#.*$/, '')}</b> or scan the square</li>
    <li>Tap <b>I'm in a class</b> and type the class code</li>
    <li>Tap your name, then your two pictures</li>
  </ol>
</div>

<style>
  .lc { width: 100%; background: #fff; border: 2.5px dashed #c9bde6; border-radius: 18px; padding: 12px 14px; color: #2b2140; display: flex; flex-direction: column; gap: 8px; break-inside: avoid; page-break-inside: avoid; }
  .top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  .kp { margin: 0; font: 800 10.5px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: #7c5cf5; }
  h3 { margin: 2px 0 0; font: 600 28px/1.05 var(--font-ui); }
  .t { margin: 2px 0 0; font: 700 12px var(--font-body); color: #6d6680; }
  .code { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .code span, .pw > span { font: 800 11px var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: #6d6680; }
  .code b { font: 600 22px var(--font-ui); background: #fff4cf; border: 2px solid #f2d88a; border-radius: 10px; padding: 0 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pw { display: flex; align-items: center; gap: 12px; }
  ol { margin: 0; padding-left: 18px; font: 600 12px/1.45 var(--font-body); color: #4a4061; }
</style>
