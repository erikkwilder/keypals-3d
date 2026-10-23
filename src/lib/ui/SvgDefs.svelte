<!-- Filters shared by every character and scene on the page. -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <defs>
    <filter id="softblur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" /></filter>
    <filter id="shadowblur" x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="3.2" /></filter>
    <filter id="bigblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" /></filter>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="inkfx" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feTurbulence id="boil" type="fractalNoise" baseFrequency="0.028" numOctaves="2" seed="1" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="art" />
      <feMorphology in="art" operator="dilate" radius="5.5" result="d" />
      <feFlood flood-color="#ffffff" result="wf" />
      <feComposite in="wf" in2="d" operator="in" result="w" />
      <feOffset in="d" dx="2" dy="4" result="do" />
      <feFlood flood-color="#2a1b3d" flood-opacity=".28" result="sf" />
      <feComposite in="sf" in2="do" operator="in" result="sh" />
      <feMerge><feMergeNode in="sh" /><feMergeNode in="w" /><feMergeNode in="art" /></feMerge>
    </filter>
    <filter id="inkline" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence id="boil2" type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="1" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="pp" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.3" flood-color="#3d3020" flood-opacity=".3" /></filter>
    <filter id="ppbig" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#3d3020" flood-opacity=".28" /></filter>
    <filter id="paperfx" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="warp" />
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.8" xChannelSelector="R" yChannelSelector="G" result="rough" />
      <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="3" result="g" />
      <feColorMatrix in="g" type="saturate" values="0" result="gg" />
      <feComponentTransfer in="gg" result="gl"><feFuncR type="linear" slope=".16" intercept=".9" /><feFuncG type="linear" slope=".16" intercept=".9" /><feFuncB type="linear" slope=".16" intercept=".9" /><feFuncA type="linear" slope="0" intercept="1" /></feComponentTransfer>
      <feBlend in="rough" in2="gl" mode="multiply" result="m" />
      <feComposite in="m" in2="rough" operator="in" />
    </filter>
    <filter id="papergrain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="11" result="g" />
      <feColorMatrix in="g" type="saturate" values="0" result="gg" />
      <feComponentTransfer in="gg" result="gl"><feFuncR type="linear" slope=".14" intercept=".9" /><feFuncG type="linear" slope=".14" intercept=".9" /><feFuncB type="linear" slope=".14" intercept=".9" /><feFuncA type="linear" slope="0" intercept="1" /></feComponentTransfer>
      <feBlend in="SourceGraphic" in2="gl" mode="multiply" result="m" />
      <feComposite in="m" in2="SourceGraphic" operator="in" />
    </filter>
    <filter id="lockedfx" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0" /><feComponentTransfer><feFuncR type="linear" slope=".35" intercept=".58" /><feFuncG type="linear" slope=".35" intercept=".55" /><feFuncB type="linear" slope=".35" intercept=".64" /></feComponentTransfer></filter>
  </defs>
</svg>
