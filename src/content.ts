// All the words on the site live here. Edit freely — the 3D world, cards and
// classic view are all generated from this file.

export const profile = {
  name: 'Greg Chlosta',
  headline: 'Staff software engineer · AI builder · fixer of things',
  intro:
    "I love AI, I love writing software, and I love taking things apart and making them work better — whether it's a distributed system, a car, or the house I live in.",
  location: 'Calgary, Alberta',
  phone: '587 832 4640',
  phoneHref: 'tel:+15878324640',
  email: 'grzegorz.chlosta@gmail.com',
  linkedin: 'https://www.linkedin.com/in/greg-chlosta/',
  github: 'https://github.com/gregchlosta',
};

export type IconName = 'mail' | 'phone' | 'linkedin' | 'github';

export interface Link {
  label: string;
  href: string;
  icon: IconName;
}

export const contactLinks: Link[] = [
  { label: profile.email, href: `mailto:${profile.email}`, icon: 'mail' },
  { label: profile.phone, href: profile.phoneHref, icon: 'phone' },
  { label: 'LinkedIn', href: profile.linkedin, icon: 'linkedin' },
  { label: 'GitHub', href: profile.github, icon: 'github' },
];

export type StationKind = 'ai' | 'code' | 'garage' | 'moto' | 'trail' | 'calgary' | 'home' | 'contact';

export interface Station {
  id: StationKind;
  /** Short name floating above the stop in the 3D world. */
  label: string;
  tag: string;
  title: string;
  color: string;
  facts: string[];
  links?: Link[];
}

// Stations are placed clockwise around the trail in this order.
export const stations: Station[] = [
  {
    id: 'ai',
    label: 'AI Lab',
    tag: 'Obsession #1',
    title: 'I love building with AI',
    color: '#a78bfa',
    facts: [
      'AI is the most exciting thing to happen to software in my lifetime — and I am all in.',
      'I build with LLMs and agents: prototypes, internal tools, automations and production features.',
      'I care about making AI genuinely useful: good evals, sensible guardrails, real problems solved.',
      'Always experimenting with the newest models and tools. This site was built with an AI pair-programmer.',
    ],
  },
  {
    id: 'code',
    label: 'Code Shop',
    tag: 'The craft',
    title: 'Staff-level software engineer',
    color: '#38bdf8',
    facts: [
      'I design systems, write the tricky parts, and help teams ship things that last.',
      'Happiest when turning a messy problem into a simple, well-built solution.',
      'Big believer in clean architecture, fast feedback loops and code that is easy to change.',
      'I enjoy mentoring and raising the bar for the people around me.',
    ],
    links: [{ label: 'GitHub', href: profile.github, icon: 'github' }],
  },
  {
    id: 'garage',
    label: 'Garage',
    tag: 'Hands-on',
    title: "If it's broken, I'll fix it",
    color: '#fb923c',
    facts: [
      'I do my own car work whenever I can — maintenance, repairs and the occasional "how hard can it be?"',
      'Diagnosing a weird noise is just debugging with more grease.',
      'A good set of tools and a free Saturday is my idea of a great time.',
    ],
  },
  {
    id: 'moto',
    label: 'Moto & Cars',
    tag: 'Passion',
    title: 'Motorcycles & cars',
    color: '#f43f5e',
    facts: [
      'Two wheels or four — I love machines that are fun to drive.',
      'Nothing clears my head like a ride on an open Alberta road.',
      "I'm as interested in how they work as in how they feel.",
    ],
  },
  {
    id: 'trail',
    label: 'Trailhead',
    tag: 'Outdoors',
    title: 'Mountain biking',
    color: '#4ade80',
    facts: [
      'Living next to the Rockies means world-class trails are an easy drive away.',
      'Climb for the view, descend for the grin.',
      'And yes — I wrench on my own bikes too.',
    ],
  },
  {
    id: 'calgary',
    label: 'Calgary',
    tag: 'Home base',
    title: 'Based in Calgary, Alberta',
    color: '#facc15',
    facts: [
      'Calgary is home — big prairie sky on one side, the Rocky Mountains on the other.',
      'Open to interesting conversations, collaborations and side projects.',
    ],
  },
  {
    id: 'home',
    label: 'Home Projects',
    tag: 'Builder',
    title: 'Projects around the house',
    color: '#2dd4bf',
    facts: [
      "Renovations, repairs, upgrades — I'd rather learn it and do it myself.",
      'Same mindset as engineering: understand the system, plan the work, measure twice.',
      'There is always a next project on the list.',
    ],
  },
  {
    id: 'contact',
    label: 'Say hello',
    tag: 'Contact',
    title: "Let's talk",
    color: '#f472b6',
    facts: [
      'AI, software, or a project you want a second pair of hands on — I would love to hear from you.',
    ],
    links: contactLinks,
  },
];
