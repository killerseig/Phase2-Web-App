// Shared, browser-safe contracts and CSS compiler used by editor and server validation.
export type WebsiteDevice = 'desktop' | 'tablet' | 'mobile'
export interface ContainerLayout {
  direction: 'row' | 'column'
  gap: number
  wrap?: boolean
  align?: 'stretch' | 'start' | 'center' | 'end'
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
}
export interface ItemSizing {
  grow?: number
  basis?: number
  minHeight?: number
  height?: number
  align?: 'auto' | 'stretch' | 'start' | 'center' | 'end'
}
export interface PageLayout {
  desktop?: 'grid' | 'flow'
  tablet?: 'scale' | 'flow'
  mobile?: 'scale' | 'flow'
  gap?: number
  padding?: number
}
export const pageCssTemplate = `/* Page styles override matching appearance controls.
   Add a CSS class such as custom-feature to a widget to target it.
   Media queries follow the preview width as well as the public page. */
.page {
  background-color: #ffffff;
  color: #172c40;
  font-family: 'Segoe UI', sans-serif;
}
.widget-title {
  letter-spacing: -0.02em;
}
.widget-button {
  border-radius: 8px;
}
/* .custom-feature { background-color: #eaf0f5; padding: 24px; } */
/* .custom-feature { animation: fade-in 600ms ease-out; }
   Other entrance effects: fade-up, slide-in, zoom-in.
   Hover fades: transition: opacity 200ms ease-out; */
@media (max-width: 767px) {
  .widget-title { font-size: 28px; }
  .page-header { gap: 12px; }
}
`
const hooks = new Set([
  'page',
  'page-header',
  'page-footer',
  'page-content',
  'page-brand',
  'page-navigation',
  'widget',
  'widget-title',
  'widget-text',
  'widget-image',
  'widget-button',
  'container-items',
])
const properties = new Set(
  'color background background-color background-image font-family font-size font-weight font-style line-height letter-spacing text-align text-transform text-decoration text-shadow white-space overflow-wrap word-break border border-color border-width border-style border-radius box-shadow padding padding-top padding-right padding-bottom padding-left margin margin-top margin-right margin-bottom margin-left gap row-gap column-gap opacity object-fit object-position max-width min-width width min-height max-height height display flex-direction flex-wrap align-items align-self justify-content flex-grow flex-basis grid-template-columns'.split(
    ' ',
  ),
)
export function compilePageCss(source: string, scopeId: string): string {
  if (typeof source !== 'string' || source.length > 12000)
    throw new Error('Page CSS is limited to 12,000 characters.')
  if (!/^[a-zA-Z0-9_-]+$/.test(scopeId)) throw new Error('Invalid page CSS scope.')
  if (/[<\\\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source))
    throw new Error('Use plain CSS without HTML or escape sequences.')
  const input = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
  if (input.includes('/*') || input.includes('*/'))
    throw new Error('Close the CSS comment with */.')
  const scope = `[data-page-scope="${scopeId}"]`
  const motionNames = new Set<string>()
  let hasTransition = false
  const effectFrames: Record<string, string> = {
    'fade-in': 'from{opacity:0}to{opacity:1}',
    'fade-up': 'from{opacity:0;translate:0 24px}to{opacity:1;translate:0 0}',
    'slide-in': 'from{opacity:0;translate:-24px 0}to{opacity:1;translate:0 0}',
    'zoom-in': 'from{opacity:0;scale:0.96}to{opacity:1;scale:1}',
  }
  let rules = 0
  function error(message: string, position: number): never {
    throw new Error(`Line ${input.slice(0, position).split('\n').length}: ${message}`)
  }
  function selector(value: string, position: number) {
    const parts = value.trim().split(/\s+/)
    if (!parts.length || parts.length > 5) error('Use a page or widget class selector.', position)
    for (const part of parts) {
      if (part === 'img' || part === '>') continue
      const match = /^\.([a-z][a-z0-9-]*)(?::(hover|focus-visible))?$/.exec(part)
      if (!match || (!hooks.has(match[1]!) && !/^custom-[a-z][a-z0-9-]{0,32}$/.test(match[1]!)))
        error(
          'Use template classes or a custom- class. Only :hover and :focus-visible are supported.',
          position,
        )
    }
    if (parts.includes('>') && (parts[0] === '>' || parts[parts.length - 1] === '>'))
      error('Complete the child selector.', position)
    return /^\.page(?::|\s|$)/.test(value.trim())
      ? scope + value.trim().slice(5)
      : `${scope} ${value.trim()}`
  }
  function declarations(body: string, position: number) {
    return body
      .split(';')
      .filter((value) => value.trim())
      .map((declaration) => {
        const match = /^\s*([a-z-]+)\s*:\s*(.*?)\s*$/s.exec(declaration)
        if (!match) error('Expected property: value;.', position)
        const property = match[1]!,
          value = match[2]!.replace(/\s*!important\s*$/, '')
        if (property === 'animation') {
          if (value === 'none') return 'animation:none!important;'
          const motion =
            /^(fade-in|fade-up|slide-in|zoom-in)\s+(\d+(?:\.\d+)?)(ms|s)(?:\s+(linear|ease|ease-in|ease-out|ease-in-out))?(?:\s+(\d+(?:\.\d+)?)(ms|s))?$/.exec(
              value,
            )
          if (
            !motion ||
            Number(motion[2]) * (motion[3] === 's' ? 1000 : 1) < 100 ||
            Number(motion[2]) * (motion[3] === 's' ? 1000 : 1) > 3000 ||
            Number(motion[5] || 0) * (motion[6] === 's' ? 1000 : 1) > 3000
          )
            error(
              'Use a named entrance animation with a duration of 100–3000 ms and a delay up to 3000 ms.',
              position,
            )
          motionNames.add(motion[1]!)
          return `animation:website-${scopeId}-${value} both!important;`
        }
        if (property === 'transition') {
          if (
            value !== 'none' &&
            !value.split(',').every((part) => {
              const transition =
                /^\s*(opacity|color|background-color|border-color|box-shadow)\s+(\d+(?:\.\d+)?)(ms|s)(?:\s+(linear|ease|ease-in|ease-out|ease-in-out))?\s*$/.exec(
                  part,
                )
              return (
                transition && Number(transition[2]) * (transition[3] === 's' ? 1000 : 1) <= 3000
              )
            })
          )
            error('Use an opacity or color/shadow transition lasting up to 3000 ms.', position)
          hasTransition = true
          return `transition:${value}!important;`
        }
        if (!properties.has(property) && !/^--[a-z][a-z0-9-]{0,40}$/.test(property))
          error(`Unsupported CSS property: ${property}.`, position)
        if (!value || value.length > 500 || !/^[a-zA-Z0-9\s#.,%()+*/'"_-]+$/.test(value))
          error(`Invalid value for ${property}.`, position)
        for (const fn of value.matchAll(/([a-zA-Z-]+)\s*\(/g))
          if (
            ![
              'rgb',
              'rgba',
              'hsl',
              'hsla',
              'calc',
              'min',
              'max',
              'clamp',
              'var',
              'linear-gradient',
              'radial-gradient',
            ].includes(fn[1]!.toLowerCase())
          )
            error(
              `Unsupported CSS function: ${fn[1]}. External resources are not supported.`,
              position,
            )
        let depth = 0
        for (const char of value) {
          if (char === '(') depth++
          if (char === ')' && --depth < 0) error('Unbalanced CSS parentheses.', position)
        }
        if (depth) error('Close the CSS parentheses.', position)
        return `${property}:${value}!important;`
      })
      .join('')
  }
  function parse(start: number, end: number, nested = false): string {
    let output = '',
      index = start
    while (index < end) {
      while (/\s/.test(input[index] || '') && index < end) index++
      if (index === end) break
      const open = input.indexOf('{', index)
      if (open < 0 || open >= end) error('Expected a selector followed by { declarations }.', index)
      const header = input.slice(index, open).trim()
      let cursor = open + 1,
        depth = 1
      while (cursor < end && depth) {
        if (input[cursor] === '{') depth++
        if (input[cursor] === '}') depth--
        cursor++
      }
      if (depth) error('Close the CSS rule with }.', open)
      if (++rules > 100) error('Use no more than 100 CSS rules.', index)
      if (header.startsWith('@')) {
        const media =
          /^@media\s+\((min|max)-width:\s*(\d+)px\)(?:\s+and\s+\((min|max)-width:\s*(\d+)px\))?$/.exec(
            header,
          )
        if (nested || !media)
          error(
            'Use @media (max-width: 767px) or a min/max-width range; other at-rules are unsupported.',
            index,
          )
        if (
          [media[2], media[4]]
            .filter(Boolean)
            .some((value) => Number(value) < 1 || Number(value) > 4000)
        )
          error('Media widths must be between 1 and 4000 pixels.', index)
        output += `@container website-page ${header.slice(6).trim()}{${parse(open + 1, cursor - 1, true)}}`
      } else {
        if (input.slice(open + 1, cursor - 1).includes('{'))
          error('CSS nesting is unsupported; write separate rules.', open)
        const selectors = header
          .split(',')
          .map((value) => selector(value, index))
          .join(',')
        output += `${selectors}{${declarations(input.slice(open + 1, cursor - 1), open)}}`
      }
      index = cursor
    }
    return output
  }
  const compiled = parse(0, input.length)
  const keyframes = [...motionNames]
    .map((name) => `@keyframes website-${scopeId}-${name}{${effectFrames[name]}}`)
    .join('')
  const reduced =
    motionNames.size || hasTransition
      ? `@media (prefers-reduced-motion: reduce){${scope},${scope} *{animation:none!important;transition:none!important;}}`
      : ''
  return compiled + keyframes + reduced
}
