import type { WebsitePage, WebsiteSection, WebsiteSite } from './types'
import type { WebsiteFormDefinition } from '../../../functions/src/websiteForms'
import { polishPhase2Site } from './phase2Polish'

export interface Phase2Images {
  logo: string
  interior: string
  architecture?: string
  finished?: string
  planning?: string
}

// Ordinary builder data: owners can edit every widget, photograph, link and style.
// Images are illustrative. Never invent company credentials, projects or personnel.
export function phase2Site(images: Phase2Images): WebsiteSite {
  let sequence = 0
  const blue = '#075486',
    ink = '#122d3d',
    paper = '#f5f4f0',
    line = '#d5dedf'
  const photos = {
    architecture: images.architecture || images.interior,
    finished: images.finished || images.interior,
    planning: images.planning || images.interior,
    interior: images.interior,
  }
  type Photo = keyof typeof photos
  const descriptions: Record<Photo, string> = {
    architecture:
      'Illustrative modern commercial building in warm evening light; not a Phase 2 project.',
    finished:
      'Illustrative finished interior with warm wood, glass and carefully detailed ceilings.',
    planning: 'Illustrative architectural drawings and material samples on a planning table.',
    interior: 'Illustrative interior construction with framing and ceiling work in progress.',
  }
  function widget(
    type: WebsiteSection['type'],
    title: string,
    text = '',
    extra: Partial<WebsiteSection> = {},
  ): WebsiteSection {
    return {
      id: `phase2-design-${++sequence}`,
      type,
      title,
      text,
      imageId: '',
      alt: '',
      linkLabel: '',
      linkUrl: '',
      hidden: false,
      items: [],
      appearance: { padding: 64, radius: 0, color: ink },
      devices: {
        tablet: { appearance: { padding: 32 } },
        mobile: { appearance: { padding: 20, fontSize: 16 } },
      },
      ...extra,
    }
  }
  function photo(key: Photo) {
    return {
      imageId: photos[key],
      alt: descriptions[key],
      imageSettings: {
        caption: 'Illustrative photography',
        focusX: key === 'architecture' ? 70 : 50,
        focusY: 50,
      },
    }
  }
  function label(text: string, dark = false) {
    return widget('card', text, text, {
      styleClass: 'custom-eyebrow',
      appearance: {
        padding: 64,
        paddingTop: 40,
        paddingBottom: 0,
        background: dark ? ink : '#ffffff',
        color: dark ? '#9bccdf' : blue,
        headingSize: 13,
        fontSize: 13,
      },
      devices: {
        tablet: { appearance: { padding: 32, paddingTop: 28, paddingBottom: 0, fontSize: 12 } },
        mobile: { appearance: { padding: 20, paddingTop: 24, paddingBottom: 0, fontSize: 11 } },
      },
    })
  }
  function hero(title: string, text: string, key: Photo, home = false) {
    return widget('hero', title, text, {
      ...photo(key),
      styleClass: home ? 'custom-home-hero' : 'custom-page-hero',
      appearance: {
        background: ink,
        color: '#ffffff',
        padding: 64,
        paddingTop: 32,
        paddingBottom: 64,
        headingSize: home ? 68 : 58,
        fontSize: 18,
      },
      devices: {
        tablet: { appearance: { padding: 32, headingSize: 46, fontSize: 17 } },
        mobile: {
          appearance: {
            padding: 20,
            paddingTop: 18,
            paddingBottom: 24,
            headingSize: home ? 34 : 32,
            fontSize: 16,
          },
        },
      },
      ...(home ? { linkLabel: 'Discover Phase 2', linkUrl: '/website/company' } : {}),
    })
  }
  function intro(title: string, text: string) {
    return widget('card', title, text, {
      styleClass: 'custom-intro',
      appearance: { padding: 64, paddingTop: 24, paddingBottom: 32, headingSize: 44, fontSize: 18 },
      devices: {
        tablet: {
          appearance: {
            padding: 32,
            paddingTop: 20,
            paddingBottom: 28,
            headingSize: 36,
            fontSize: 17,
          },
        },
        mobile: {
          appearance: {
            padding: 20,
            paddingTop: 16,
            paddingBottom: 24,
            headingSize: 28,
            fontSize: 16,
          },
        },
      },
    })
  }
  type Card = { title: string; text: string; photo?: Photo; slug?: string; action?: string }
  function cards(entries: Card[], followedByCards = false) {
    const group = widget('container', 'Information cards', '', {
      styleClass: 'custom-card-row',
      appearance: { padding: 64, paddingTop: 8, paddingBottom: followedByCards ? 16 : 72 },
      container: { direction: 'row', gap: 24, wrap: false, align: 'stretch' },
      devices: {
        tablet: {
          appearance: { padding: 32, paddingTop: 8, paddingBottom: followedByCards ? 16 : 40 },
        },
        mobile: {
          appearance: { padding: 20, paddingTop: 0, paddingBottom: followedByCards ? 16 : 28 },
          container: { direction: 'column', gap: 16, align: 'stretch' },
        },
      },
    })
    return [
      group,
      ...entries.map((entry) =>
        widget('card', entry.title, entry.text, {
          parentId: group.id,
          sizing: { grow: 1 },
          styleClass: entry.photo ? 'custom-photo-card' : 'custom-detail-card',
          appearance: {
            padding: entry.photo ? 0 : 28,
            headingSize: 25,
            fontSize: 16,
            background: entry.photo ? '#ffffff' : paper,
            borderWidth: entry.photo ? 0 : 1,
            borderColor: line,
          },
          devices: {
            tablet: { appearance: { padding: entry.photo ? 0 : 22, headingSize: 23 } },
            mobile: {
              appearance: { padding: entry.photo ? 0 : 18, headingSize: 22, fontSize: 16 },
            },
          },
          ...(entry.photo ? photo(entry.photo) : {}),
          ...(entry.slug
            ? { linkLabel: entry.action || 'Explore more →', linkUrl: `/website/${entry.slug}` }
            : {}),
        }),
      ),
    ]
  }
  function split(
    title: string,
    text: string,
    key: Photo,
    options: { reverse?: boolean; dark?: boolean; slug?: string; action?: string } = {},
  ) {
    return widget('image-text', title, text, {
      ...photo(key),
      styleClass: options.reverse ? 'custom-feature-reverse' : 'custom-feature',
      appearance: {
        padding: 64,
        background: options.dark ? ink : paper,
        color: options.dark ? '#ffffff' : ink,
        headingSize: 42,
        fontSize: 18,
      },
      devices: {
        tablet: { appearance: { padding: 32, headingSize: 34, fontSize: 17 } },
        mobile: {
          appearance: {
            padding: 20,
            paddingTop: 28,
            paddingBottom: 28,
            headingSize: 28,
            fontSize: 16,
          },
        },
      },
      ...(options.slug
        ? { linkLabel: options.action || 'Explore more →', linkUrl: `/website/${options.slug}` }
        : {}),
    })
  }
  function careersBand() {
    const band = widget(
      'container',
      'Good work takes\ngood people.',
      'Bring your experience, your curiosity and your pride in the details. Start your next conversation with Phase 2.',
      {
        styleClass: 'custom-careers-band',
        container: { direction: 'row', gap: 48, align: 'center', wrap: false },
        appearance: {
          padding: 80,
          background: blue,
          color: '#ffffff',
          headingSize: 48,
          textAlign: 'left',
        },
        devices: {
          tablet: {
            appearance: { padding: 40, headingSize: 38, fontSize: 17 },
            container: { direction: 'row', gap: 32, align: 'center', wrap: false },
          },
          mobile: {
            container: { direction: 'column', gap: 20, align: 'stretch' },
            appearance: {
              padding: 24,
              paddingTop: 28,
              paddingBottom: 28,
              headingSize: 28,
              fontSize: 16,
            },
          },
        },
        linkLabel: 'Explore careers →',
        linkUrl: '/website/careers',
      },
    )
    return [
      band,
      {
        ...band,
        id: `${band.id}-copy`,
        type: 'card' as const,
        parentId: band.id,
        styleClass: 'custom-careers-copy',
        appearance: {
          padding: 0,
          background: blue,
          color: '#ffffff',
          headingSize: 48,
          fontSize: 18,
        },
        devices: {
          tablet: { appearance: { headingSize: 38, fontSize: 17 } },
          mobile: { appearance: { headingSize: 28, fontSize: 16 } },
        },
        sizing: { grow: 1 },
        container: undefined,
        linkLabel: '',
        linkUrl: '',
      },
      {
        ...band,
        id: `${band.id}-action`,
        type: 'button' as const,
        parentId: band.id,
        title: band.linkLabel,
        text: '',
        styleClass: 'custom-careers-action',
        appearance: { padding: 0, background: blue },
        devices: {},
        sizing: { basis: 25, grow: 0 },
        container: undefined,
      },
    ]
  }
  function page(
    slug: string,
    title: string,
    description: string,
    sections: WebsiteSection[],
    inNavigation = true,
  ): WebsitePage {
    return {
      id: `phase2-${slug}`,
      slug,
      title,
      description,
      inNavigation,
      chrome: 'widgets',
      useSiteLayout: true,
      layout: { desktop: 'flow', tablet: 'flow', mobile: 'flow', gap: 0, padding: 0 },
      sections,
    }
  }
  function list(title: string, entries: [string, string][]) {
    // Keep the original step/widget IDs when arranging the content as editable cards.
    const items = entries.map(([title, text]) => ({
      id: `phase2-step-${++sequence}`,
      title,
      text,
    }))
    const heading = widget(
      'card',
      title,
      'Four starting points for a useful planning conversation.',
      {
        styleClass: 'custom-process',
        appearance: { padding: 64, paddingBottom: 24, background: paper, headingSize: 38 },
        devices: {
          tablet: { appearance: { padding: 32, paddingBottom: 20, headingSize: 32 } },
          mobile: { appearance: { padding: 20, paddingBottom: 20, headingSize: 28, fontSize: 16 } },
        },
      },
    )
    const row: WebsiteSection = {
      ...heading,
      id: `${heading.id}-grid`,
      type: 'container',
      title: 'Planning questions',
      styleClass: 'custom-card-row',
      appearance: { padding: 64, paddingTop: 0, background: paper },
      container: { direction: 'row', gap: 20, wrap: true, align: 'stretch' },
      devices: {
        tablet: { appearance: { padding: 32, paddingTop: 0 } },
        mobile: {
          appearance: { padding: 20, paddingTop: 0, paddingBottom: 28 },
          container: { direction: 'column', gap: 16, align: 'stretch' },
        },
      },
    }
    return [
      heading,
      row,
      ...items.map((item, index) => ({
        ...heading,
        ...item,
        title: `${String(index + 1).padStart(2, '0')} / ${item.title}`,
        parentId: row.id,
        styleClass: 'custom-detail-card',
        sizing: { basis: 46, grow: 1 },
        appearance: { padding: 24, background: '#ffffff', headingSize: 24, fontSize: 16 },
        devices: {
          tablet: { appearance: { padding: 22, headingSize: 23 } },
          mobile: { appearance: { padding: 18, headingSize: 22 } },
        },
      })),
    ]
  }
  const careers: WebsiteFormDefinition = {
    id: 'phase2-careers',
    name: 'Introduce yourself',
    description:
      'Tell us a little about your experience and the work that interests you. This is an expression of interest, not an application for a listed opening.',
    buttonLabel: 'Send introduction',
    successMessage: 'Thank you. Your introduction has been received.',
    replyToField: 'email',
    delivery: { to: [], cc: [], subject: 'Website career interest' },
    fields: [
      { id: 'name', label: 'Name', type: 'text', required: true, options: [] },
      { id: 'email', label: 'Email', type: 'email', required: true, options: [] },
      {
        id: 'message',
        label: 'Tell us about your experience and interests',
        type: 'textarea',
        required: true,
        options: [],
      },
    ],
  }
  const formGroup = widget('container', 'Careers introduction', '', {
    styleClass: 'custom-application',
    appearance: { padding: 64, background: paper },
    container: { direction: 'row', gap: 64, align: 'start', wrap: false },
    devices: {
      tablet: { appearance: { padding: 32 }, container: { direction: 'column', gap: 28 } },
      mobile: { appearance: { padding: 20 }, container: { direction: 'column', gap: 20 } },
    },
  })
  const pages = [
    page(
      'home',
      'Home',
      'Phase 2 brings people, planning and attention to detail to the work. Explore our company, services and careers.',
      [
        label('PHASE 2 / PEOPLE. PLANNING. CRAFT.', true),
        hero(
          'Good work starts\nwith good people.',
          'From the first drawing to the final detail. Explore the thinking, coordination and care behind Phase 2.',
          'architecture',
          true,
        ),
        label('01 / A THOUGHTFUL APPROACH'),
        intro(
          'The big picture.\nThe smallest details.',
          'A project is more than a set of plans. It is a series of decisions, conversations and details that have to come together. Get to know the people and the approach behind the work.',
        ),
        ...cards([
          {
            title: 'Plan with purpose.',
            text: 'A clearer scope makes room for better conversations about quantities, budgets and what comes next.',
            slug: 'services',
            action: 'Our services →',
          },
          {
            title: 'Build understanding.',
            text: 'Office teams, project leadership and field operations bring different perspectives to the same work.',
            slug: 'company',
            action: 'Our company →',
          },
          {
            title: 'Keep people in view.',
            text: 'Safety information and clear communication belong in the conversation from the start.',
            slug: 'safety',
            action: 'Safety & resources →',
          },
        ]),
        split(
          'From a drawing\nto a considered space.',
          'The work starts long before the finished photograph. Scope, quantities, materials and coordination all shape the decisions that follow.',
          'planning',
          { slug: 'services', action: 'Explore preconstruction →' },
        ),
        label('02 / A CLOSER LOOK'),
        intro(
          'Spaces. Materials.\nDetails that matter.',
          'Explore an illustrative look at the environments and details behind a building. Approved Phase 2 project stories will replace these image studies.',
        ),
        ...cards([
          {
            title: 'The finished space',
            text: 'Light, proportion and materials, brought into focus.',
            photo: 'finished',
            slug: 'projects',
            action: 'Explore the gallery →',
          },
          {
            title: 'The work behind it',
            text: 'The structure and coordination beneath the finished surface.',
            photo: 'interior',
            slug: 'projects',
            action: 'Behind the details →',
          },
        ]),
        split(
          'People are the\nconstant.',
          'Plans evolve. Conditions change. The people who ask questions, share information and care about the result keep the work moving.',
          'finished',
          { dark: true, reverse: true, slug: 'company', action: 'Meet the organization →' },
        ),
        ...careersBand(),
      ],
      false,
    ),
    page(
      'company',
      'Company',
      'Meet the office, project, field, operations and safety roles behind Phase 2.',
      [
        label('OUR COMPANY / BUILT AROUND PEOPLE', true),
        hero(
          'People behind\nthe progress.',
          'Different perspectives. Shared purpose. A closer look at the people and thinking that connect the office to the field.',
          'finished',
        ),
        label('WHO WE ARE'),
        intro(
          'Good work is\na team effort.',
          'Phase 2 brings together office staff, project managers, superintendents, operations and safety. Every role contributes a different view of the work—from early planning and coordination to the details that need attention on site.',
        ),
        ...cards([
          {
            title: 'Office & project teams',
            text: 'The conversations, documentation and planning that connect a project’s moving parts.',
          },
          {
            title: 'Field & operations',
            text: 'A close view of site activities, coordination, personnel, equipment and the work ahead.',
          },
          {
            title: 'Safety',
            text: 'A resource for questions, company information and the requirements specific to a job.',
            slug: 'safety',
            action: 'Safety resources →',
          },
        ]),
        split(
          'Care in the details.\nClarity in the process.',
          'Ask useful questions. Share what matters. Follow through on the details. These simple ideas provide a strong foundation for the way people work together.',
          'planning',
          { reverse: true },
        ),
        label('THE PEOPLE & THE WORK'),
        ...cards([
          {
            title: 'Our team, in their own words',
            text: 'Individual introductions and approved biographies will be added here as the team’s stories are collected.',
            slug: 'careers',
            action: 'Find your next conversation →',
          },
          {
            title: 'Recognition worth sharing',
            text: 'A dedicated place for verified awards and the people and projects behind them.',
            slug: 'awards',
            action: 'Recognition →',
          },
        ]),
        ...careersBand(),
      ],
    ),
    page(
      'services',
      'Services',
      'Preconstruction, estimating, budgeting and takeoffs. Start with a clearer understanding of the work.',
      [
        label('OUR SERVICES / BEFORE THE FIRST STEP', true),
        hero(
          'Clarity before\nconstruction.',
          'Good questions. Useful information. A more considered starting point for the work ahead.',
          'planning',
        ),
        label('PRECONSTRUCTION & PLANNING'),
        intro(
          'Turn information\ninto a clearer plan.',
          'Drawings and ideas need context. Our service conversations focus on scope, quantities and budgets, helping define what is known and what needs a closer look.',
        ),
        ...cards(
          [
            {
              title: '01 / Preconstruction',
              text: 'Bring the scope, priorities and project questions into the same conversation before decisions become commitments.',
            },
            {
              title: '02 / Estimating',
              text: 'Review the information behind an estimate: the drawings, scope, quantities and assumptions that shape the work.',
            },
          ],
          true,
        ),
        ...cards([
          {
            title: '03 / Budgeting',
            text: 'Consider budget priorities alongside the scope. Identify the choices and unknowns that deserve attention.',
          },
          {
            title: '04 / Takeoffs',
            text: 'Look closely at drawings and quantities so the discussion starts from a more detailed understanding of the project.',
          },
        ]),
        split(
          'The details start\non the drawing.',
          'A useful planning conversation starts with the available information. Drawings, scope notes, schedule considerations and material preferences all help frame the questions.',
          'interior',
          { reverse: true, slug: 'location', action: 'Company information →' },
        ),
        ...list('Bring the right questions.', [
          ['Scope', 'What is included, and what still needs to be defined?'],
          ['Information', 'Which drawings, specifications and quantities are available?'],
          ['Priorities', 'What matters most to the project’s budget and schedule?'],
          ['Next steps', 'Which decisions or clarifications are needed to move forward?'],
        ]),
        ...careersBand(),
      ],
    ),
    page(
      'location',
      'Location',
      'Phase 2 office information and ways to find the right resources.',
      [
        label('LOCATION / FIND YOUR NEXT STEP', true),
        hero(
          'Connected to\nthe work.',
          'Find company information, explore opportunities and access the resources used by our team.',
          'architecture',
        ),
        label('COMPANY INFORMATION'),
        intro(
          'The right information.\nThe right starting point.',
          'Our office address, phone number and business hours are awaiting confirmation. Verified details will be posted here before the website is launched.',
        ),
        ...cards([
          { title: 'Office', text: 'Address and visiting information to be confirmed.' },
          { title: 'Phone & hours', text: 'Telephone number and office hours to be confirmed.' },
        ]),
        split(
          'Start with\nwhat interests you.',
          'Learn about our planning services, get to know the organization or introduce yourself through Careers.',
          'finished',
          { slug: 'services', action: 'Explore our services →' },
        ),
        ...careersBand(),
      ],
    ),
    page(
      'safety',
      'Safety',
      'Company safety resources and access to job-specific information for Phase 2 employees.',
      [
        label('SAFETY / PEOPLE COME FIRST', true),
        hero(
          'Keep people\nin the picture.',
          'The right information, in the right hands, before the work begins.',
          'interior',
        ),
        label('INFORMATION THAT SUPPORTS THE WORK'),
        intro(
          'Start a conversation.\nShare what matters.',
          'Every job brings its own questions and conditions. Company resources and job-specific information help the team prepare for those conversations and know where to look for support.',
        ),
        ...cards([
          {
            title: 'Company resources',
            text: 'Approved company guidance and reference materials provide a common starting point.',
          },
          {
            title: 'Job information',
            text: 'Use the employee application for documents and resources associated with your assigned work.',
          },
          {
            title: 'Questions & observations',
            text: 'Bring site-specific questions to the appropriate company or job contact.',
          },
        ]),
        widget(
          'contact',
          'Resources for\nthe people doing the work.',
          'Employees can sign in to access the documents and resources available for their role and assigned jobs.',
          {
            styleClass: 'custom-careers-band',
            appearance: {
              padding: 72,
              background: blue,
              color: '#ffffff',
              headingSize: 48,
              textAlign: 'left',
            },
            devices: {
              tablet: { appearance: { padding: 32, headingSize: 36 } },
              mobile: { appearance: { padding: 20, headingSize: 28, fontSize: 16 } },
            },
            linkLabel: 'Employee login →',
            linkUrl: '/login',
          },
        ),
        split(
          'Preparation is\npart of the work.',
          'Good coordination includes making room for questions and keeping relevant information accessible. This public page introduces the resources; detailed company and job materials remain in the employee application.',
          'planning',
          { reverse: true },
        ),
      ],
    ),
    page(
      'careers',
      'Careers',
      'Introduce yourself to Phase 2. Explore the field, office and operations roles that support the work.',
      [
        label('CAREERS / BRING YOUR PERSPECTIVE', true),
        hero(
          'Build your\nnext chapter.',
          'Bring your experience, your curiosity and your pride in a job thoughtfully done.',
          'finished',
        ),
        label('THERE IS MORE THAN ONE WAY TO CONTRIBUTE'),
        intro(
          'Different skills.\nA shared sense of purpose.',
          'From field work to project coordination and office support, the work depends on people with different strengths. Tell us where your experience and interests could fit.',
        ),
        ...cards([
          {
            title: 'In the field',
            text: 'For people who enjoy practical work, problem solving and the details of a jobsite.',
          },
          {
            title: 'Planning & operations',
            text: 'For people interested in organizing work, coordinating information and looking ahead.',
          },
          {
            title: 'Office & support',
            text: 'For people who keep communication, documentation and day-to-day details moving.',
          },
        ]),
        formGroup,
        widget(
          'card',
          'Your next step\nstarts with hello.',
          'Share your experience, the kind of work that interests you and anything else you would like the team to know.\n\nNo specific openings are listed at this time. This form lets you introduce yourself for future conversations.',
          {
            parentId: formGroup.id,
            sizing: { grow: 1 },
            styleClass: 'custom-intro',
            appearance: { padding: 0, background: paper, headingSize: 40 },
            devices: {
              tablet: { appearance: { padding: 0, headingSize: 34, fontSize: 17 } },
              mobile: { appearance: { padding: 0, headingSize: 28, fontSize: 16 } },
            },
          },
        ),
        widget('form', 'Career interest', '', {
          parentId: formGroup.id,
          sizing: { grow: 1 },
          formId: careers.id,
          appearance: { padding: 32, background: '#ffffff', borderWidth: 1, borderColor: line },
          devices: {
            tablet: { appearance: { padding: 28 } },
            mobile: { appearance: { padding: 18, headingSize: 24, fontSize: 16 } },
          },
        }),
      ],
    ),
    page(
      'insights',
      'Insights',
      'Perspectives on planning, coordination and the details behind the work.',
      [
        label('INSIGHTS / A CLOSER LOOK AT THE PROCESS', true),
        hero(
          'Ideas behind\nthe work.',
          'Perspectives on planning, coordination and the details that deserve a second look.',
          'planning',
        ),
        label('PLANNING NOTES'),
        split(
          'A clearer scope\nstarts with better questions.',
          'Before discussing quantities or budgets, take a moment to describe the work. What is included? Which information is available? What remains open? Making those questions visible gives the next conversation a useful place to start.',
          'interior',
          { slug: 'services', action: 'Explore our services →' },
        ),
        label('IN FOCUS'),
        ...cards([
          {
            title: 'The information behind a number',
            text: 'An estimate is easier to understand when the scope, drawings and assumptions travel with it.',
            photo: 'planning',
            slug: 'services',
            action: 'Estimating & takeoffs →',
          },
          {
            title: 'Look beneath the surface',
            text: 'Finished spaces tell only part of the story. The details behind them deserve attention, too.',
            photo: 'finished',
            slug: 'projects',
            action: 'Explore the image studies →',
          },
        ]),
        ...careersBand(),
      ],
    ),
    page(
      'projects',
      'Projects',
      'An illustrative gallery of spaces, materials and construction details. Verified Phase 2 project stories to follow.',
      [
        label('OUR WORK / SPACES & DETAILS', true),
        hero('Look closer.', 'The big picture is made of small details.', 'architecture'),
        label('AN ILLUSTRATIVE GALLERY'),
        intro(
          'A place for\nthe work to speak.',
          'These architectural image studies establish the visual direction for our project gallery. They are illustrative, not completed Phase 2 projects. Approved project names, scope and photography will be added here.',
        ),
        ...cards([
          {
            title: 'Material & finish',
            text: 'An illustrative interior detailing study.',
            photo: 'finished',
          },
          {
            title: 'Light & proportion',
            text: 'An illustrative commercial exterior study.',
            photo: 'architecture',
          },
        ]),
        split(
          'Before the finish.',
          'Framing, ceilings and the work in progress. An illustrative look at the layers behind a finished interior.',
          'interior',
        ),
        split(
          'Before the first step.',
          'Drawings and materials bring a different view of the work into focus. Explore our approach to preconstruction, estimating, budgeting and takeoffs.',
          'planning',
          { reverse: true, slug: 'services', action: 'Our planning services →' },
        ),
        ...careersBand(),
      ],
    ),
    page(
      'awards',
      'Awards',
      'A place for verified Phase 2 recognition and the stories behind it.',
      [
        label('RECOGNITION / PEOPLE & PROJECTS', true),
        hero(
          'Recognizing\nthe work.',
          'A place to celebrate the people, care and collaboration behind a project.',
          'finished',
        ),
        label('RECOGNITION WITH CONTEXT'),
        intro(
          'The story matters\nas much as the award.',
          'This page is reserved for verified recognition, including the awarding organization, date and related project. No awards are currently listed. Those details will be added once approved.',
        ),
        ...cards([
          {
            title: 'The people',
            text: 'Get to know the organization behind the work.',
            slug: 'company',
            action: 'About Phase 2 →',
          },
          {
            title: 'The details',
            text: 'Explore the visual direction of our project gallery.',
            slug: 'projects',
            action: 'Our work →',
          },
        ]),
      ],
      false,
    ),
  ]
  return polishPhase2Site({
    name: 'Phase 2',
    accent: blue,
    pages,
    forms: [careers],
    branding: { logoId: images.logo, logoAlt: 'Phase 2', footerText: '', footerLinks: [] },
    theme: {
      enabled: true,
      background: '#ffffff',
      surface: '#ffffff',
      text: ink,
      muted: '#526575',
      border: line,
      buttonText: '#ffffff',
      bodyFont: 'DM Sans',
      headingFont: 'display',
      fontSize: 17,
      lineHeight: 1.6,
      radius: 0,
      spacing: 0,
      contentWidth: 1600,
    },
    sharedLayout: {
      id: 'phase2-shared',
      slug: 'site-layout',
      title: 'Shared navigation and footer',
      description: '',
      inNavigation: false,
      chrome: 'widgets',
      layout: { desktop: 'flow', tablet: 'flow', mobile: 'flow', gap: 0, padding: 0 },
      sections: [
        widget('navigation', 'Navigation', '', {
          styleClass: 'custom-navigation',
          appearance: {
            padding: 18,
            paddingLeft: 64,
            paddingRight: 64,
            color: ink,
            headingSize: 28,
          },
          devices: {
            tablet: {
              appearance: { padding: 14, paddingLeft: 32, paddingRight: 32, headingSize: 26 },
            },
            mobile: {
              appearance: { padding: 12, paddingLeft: 20, paddingRight: 20, headingSize: 22 },
            },
          },
          navigation: {
            showBrand: true,
            brandText: 'PHASE 2',
            showPages: true,
            showLogin: true,
            loginLabel: { label: 'Employee login' },
            links: [],
          },
        }),
        widget('page-content', 'Page content'),
        widget(
          'footer',
          'Footer',
          'People. Planning. Pride in the details.\nIllustrative imagery · Company and project details pending approval.',
          {
            styleClass: 'custom-footer',
            appearance: {
              padding: 64,
              color: ink,
              background: paper,
              headingSize: 30,
              fontSize: 14,
            },
            devices: {
              tablet: { appearance: { padding: 32, headingSize: 26, fontSize: 14 } },
              mobile: {
                appearance: {
                  padding: 20,
                  paddingTop: 28,
                  paddingBottom: 28,
                  headingSize: 24,
                  fontSize: 13,
                },
              },
            },
            navigation: {
              showBrand: true,
              brandText: 'PHASE 2',
              showPages: false,
              showLogin: true,
              loginLabel: { label: 'Employee login' },
              links: [
                'home',
                'company',
                'services',
                'location',
                'safety',
                'careers',
                'insights',
                'projects',
                'awards',
              ].map((slug) => ({
                id: `footer-${slug}`,
                label: pages.find((p) => p.slug === slug)!.title,
                url: slug === 'home' ? '/website' : `/website/${slug}`,
              })),
            },
          },
        ),
      ],
    },
    css: `/* Finishing styles only. Edit copy, photos, links, spacing and sections with normal widgets. */
.widget-title { letter-spacing: -0.03em; white-space: pre-line; }
.widget-text { line-height: 1.6; margin: 0; }
.widget-button { transition: background-color 180ms ease, color 180ms ease; }
.widget-button:focus-visible { box-shadow: 0 0 0 3px #72bade; }
.custom-eyebrow .widget-title { display: none; }
.custom-eyebrow .widget-text { font-family: 'DM Sans', sans-serif; letter-spacing: 0.17em; line-height: 1.5; font-weight: 600; margin: 0; }
.custom-home-hero { min-height: 560px; gap: 48px; }
.custom-home-hero .widget-title { max-width: 16ch; line-height: 1.05; }
.custom-home-hero .widget-text { max-width: 42ch; }
.custom-home-hero .widget-image { height: 430px; margin: 0; border-radius: 0; }
.custom-home-hero .widget-image img, .custom-page-hero .widget-image img, .custom-feature .widget-image img, .custom-feature-reverse .widget-image img { height: 100%; }
.custom-home-hero .widget-button, .custom-page-hero .widget-button, .custom-careers-band .widget-button { background-color: #ffffff; color: #075486; border-color: #ffffff; }
.custom-home-hero .widget-button, .custom-page-hero .widget-button, .custom-feature .widget-button, .custom-feature-reverse .widget-button, .custom-careers-band .widget-button { margin-top: 20px; padding: 12px 18px; font-size: 15px; line-height: 1.4; }
.custom-home-hero .widget-button:hover, .custom-careers-band .widget-button:hover { background-color: #dceaf0; color: #122d3d; }
.custom-page-hero { min-height: 400px; gap: 48px; }
.custom-page-hero .widget-title { line-height: 1.06; }
.custom-page-hero .widget-text { max-width: 42ch; }
.custom-page-hero .widget-image { height: 320px; margin: 0; border-radius: 0; }
.custom-intro .widget-title { max-width: 24ch; line-height: 1.12; }
.custom-intro .widget-text { max-width: 72ch; }
.custom-detail-card .widget-title { margin: 0; }
.custom-detail-card .widget-button, .custom-photo-card .widget-button { font-weight: 600; color: #075486; text-decoration: none; padding-top: 12px; }
.custom-detail-card .widget-button:hover, .custom-photo-card .widget-button:hover { color: #122d3d; text-decoration: underline; }
.custom-photo-card .widget-image { max-height: 380px; height: 280px; border-radius: 0; margin-bottom: 12px; }
.custom-photo-card .widget-image img { max-height: none; height: 100%; }
.custom-feature, .custom-feature-reverse { gap: 48px; }
.custom-feature .widget-image, .custom-feature-reverse .widget-image { height: 360px; margin: 0; border-radius: 0; }
.custom-feature-reverse { flex-direction: row-reverse; }
.custom-feature .widget-title, .custom-feature-reverse .widget-title { max-width: 17ch; }
.custom-feature .widget-text, .custom-feature-reverse .widget-text { max-width: 52ch; }
.custom-careers-band .widget-title { line-height: 1.1; }
.custom-careers-band .widget-text { max-width: 62ch; }
.custom-careers-band .widget-button { margin: 0; font-weight: 700; }
.custom-careers-action { text-align: right; }
.custom-navigation .page-navigation { font-size: 14px; gap: 20px; }
.custom-navigation .page-brand, .custom-footer .page-brand { font-family: 'Saira Semi Condensed', sans-serif; letter-spacing: 0.01em; }
.custom-footer .page-navigation { max-width: 580px; gap: 20px; font-size: 14px; }
@media (max-width: 1023px) {
  .custom-home-hero { min-height: 430px; gap: 28px; }
  .custom-home-hero .widget-image { height: 320px; }
  .custom-page-hero { min-height: 360px; gap: 28px; }
  .custom-page-hero .widget-image { height: 280px; }
  .custom-photo-card .widget-image { height: 240px; }
  .custom-feature, .custom-feature-reverse { gap: 32px; }
  .custom-feature .widget-image, .custom-feature-reverse .widget-image { height: 300px; }
  .custom-navigation .page-navigation { gap: 14px; font-size: 13px; }
}
@media (max-width: 767px) {
  .custom-careers-action { text-align: left; }
  .custom-eyebrow .widget-text { letter-spacing: 0.12em; }
  .custom-home-hero, .custom-page-hero { min-height: 0; flex-direction: column; align-items: stretch; gap: 20px; }
  .custom-home-hero .widget-title { max-width: 16ch; }
  .custom-home-hero .widget-image { height: clamp(168px, 52cqw, 224px); min-height: 0; width: 100%; flex-basis: auto; }
  .custom-page-hero .widget-image { height: clamp(160px, 48cqw, 210px); min-height: 0; width: 100%; flex-basis: auto; }
  .custom-feature, .custom-feature-reverse { flex-direction: column; align-items: stretch; gap: 20px; }
  .custom-feature .widget-image, .custom-feature-reverse .widget-image { height: clamp(180px, 56cqw, 230px); min-height: 0; width: 100%; flex-basis: auto; }
  .custom-photo-card .widget-image { height: clamp(170px, 52cqw, 220px); }
  .custom-footer .page-navigation { gap: 12px 16px; font-size: 13px; }
}`,
  })
}
