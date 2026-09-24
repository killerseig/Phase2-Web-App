import { describe, expect, it } from 'vitest'
import {
  websiteVideo,
  publicHttpsUrl,
  interactiveWidgetErrors,
} from '../../../functions/src/websiteInteractive'
import { newSection, newItem } from './types'
import { publishingChecks } from './publishing'

describe('interactive website widgets', () => {
  it('normalizes supported video providers without allowing arbitrary embedded pages', () => {
    expect(websiteVideo('https://youtu.be/abcdefghijk?t=20')).toEqual({
      kind: 'embed',
      url: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
    })
    expect(
      websiteVideo('https://www.youtube.com/watch?v=abcdefghijk&autoplay=1')?.url,
    ).not.toContain('autoplay')
    expect(websiteVideo('https://www.youtube.com/shorts/abcdefghijk')?.kind).toBe('embed')
    expect(websiteVideo('https://vimeo.com/123456')?.url).toBe(
      'https://player.vimeo.com/video/123456',
    )
    expect(websiteVideo('https://cdn.example.com/demo.WEBM?token=public')?.kind).toBe('file')
    for (const value of [
      'javascript:alert(1)',
      'http://example.com/video.mp4',
      'https://youtube.com.evil.test/watch?v=abcdefghijk',
      'https://user:password@vimeo.com/1234',
      'https://example.com/page',
      'https://youtu.be/invalid',
      '//vimeo.com/123',
    ])
      expect(websiteVideo(value)).toBeNull()
    expect(publicHttpsUrl('mailto:office@example.com')).toBeNull()
  })
  it('blocks incomplete content and invalid document links in publication, including custom source content', () => {
    for (const type of ['accordion', 'tabs', 'downloads'] as const) {
      const section = newSection(type)
      expect(interactiveWidgetErrors(section)).toContain('Add at least one item.')
      section.items = [
        {
          ...newItem(),
          title: 'Details',
          text: 'Information',
          linkLabel: 'Download',
          linkUrl: 'https://example.com/document.pdf',
        },
      ]
      expect(interactiveWidgetErrors(section)).toEqual([])
      if (type === 'downloads') {
        section.items[0]!.linkUrl = '/login'
        expect(interactiveWidgetErrors(section)).toHaveLength(1)
      }
    }
    const section = newSection('video')
    const site = {
      name: 'Site',
      accent: '#174878',
      pages: [
        {
          id: 'home',
          slug: 'home',
          title: 'Home',
          description: '',
          inNavigation: true,
          sections: [section],
        },
      ],
    }
    expect(publishingChecks(site).some((issue) => issue.message.includes('video link'))).toBe(true)
    section.linkUrl = 'https://example.com/video.mp4'
    expect(publishingChecks(site).filter((issue) => issue.level === 'error')).toEqual([])
  })
})
