import { useEffect } from 'react'

/* Displacement map for the glass rim: neutral grey in the middle (no bending), strong red/blue
   gradients at the edges (light bends there, like a real glass lens). */
const MAP = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>
<defs>
<linearGradient id='x' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#f00'/><stop offset='1' stop-color='#000'/></linearGradient>
<linearGradient id='y' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#00f'/><stop offset='1' stop-color='#000'/></linearGradient>
<filter id='b'><feGaussianBlur stdDeviation='6'/></filter>
</defs>
<rect width='100' height='100' fill='#808080'/>
<rect width='100' height='100' fill='url(#x)'/>
<rect width='100' height='100' fill='url(#y)' style='mix-blend-mode:screen'/>
<rect x='7' y='7' width='86' height='86' rx='14' fill='#808080' filter='url(#b)'/>
</svg>`

export default function LiquidGlass() {
  useEffect(() => {
    const root = document.documentElement
    // url() inside backdrop-filter only works in Chrome / Edge; Safari and Firefox keep the plain frosted look.
    const chromium = 'userAgentData' in navigator
    if (chromium) root.setAttribute('data-refract', '')

    return () => root.removeAttribute('data-refract')
  }, [])

  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }} focusable="false">
      <filter id="lg-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={`data:image/svg+xml,${encodeURIComponent(MAP)}`} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="36" xChannelSelector="R" yChannelSelector="B" />
      </filter>
    </svg>
  )
}
