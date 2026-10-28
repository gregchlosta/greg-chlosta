// All the words on the site live here. Edit freely — the 3D world, cards and
// classic view are all generated from this file.

export const profile = {
  name: 'Greg Chlosta',
  headline: 'software · AI · fixer of things',
  intro:
    "I love creating and building things: code, AI, and anything that moves. Motorcycles, cars, mountain bikes... I like to fix them and I'm always curious how things work.",
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
  text: string;
  links?: Link[];
}

// Stations are placed clockwise around the trail in this order.
export const stations: Station[] = [
  {
    id: 'ai',
    label: 'AI Lab',
    tag: 'Obsession #1',
    title: 'Playing with AI',
    color: '#a78bfa',
    text:
      'AI is the most fun I\'ve had with computers in a long time. I\'m always tinkering with new models and agents, building little tools and experiments just to see what\'s possible.',
  },
  {
    id: 'code',
    label: 'Code Shop',
    tag: 'Day job',
    title: 'I write code',
    color: '#38bdf8',
    text:
      'I\'ve been writing code for years and I still love it. There\'s something really satisfying about starting with an idea and building it into something real that people can use, piece by piece.',
    links: [{ label: 'GitHub', href: profile.github, icon: 'github' }],
  },
  {
    id: 'garage',
    label: 'Garage',
    tag: 'Hands-on',
    title: "If it's broken, I'll fix it",
    color: '#fb923c',
    text:
      'I do my own car work whenever I can, from regular maintenance to the occasional "how hard can it be?" project. A good set of tools and a free Saturday is pretty much my idea of a great time.',
  },
  {
    id: 'moto',
    label: 'Moto & Cars',
    tag: 'Passion',
    title: 'Motorcycles & cars',
    color: '#f43f5e',
    text:
      'Two wheels or four, I love anything that moves. Nothing clears my head like a ride on an open Alberta road, and I\'m just as into how these machines work as how they feel to drive.',
  },
  {
    id: 'trail',
    label: 'Trailhead',
    tag: 'Outdoors',
    title: 'Mountain biking',
    color: '#4ade80',
    text:
      'Living this close to the Rockies means amazing trails are never far away. I climb for the view, come down for the grin, and of course I wrench on my own bikes too.',
  },
  {
    id: 'calgary',
    label: 'Calgary',
    tag: 'Home base',
    title: 'Calgary, Alberta',
    color: '#facc15',
    text:
      'Calgary is home, with big prairie sky on one side and the mountains on the other. Always happy to grab a coffee and chat about tech, bikes or whatever you\'re building.',
  },
  {
    id: 'home',
    label: 'Home Projects',
    tag: 'Builder',
    title: 'Projects around the house',
    color: '#2dd4bf',
    text:
      'Renovations, repairs, upgrades... if something around the house needs doing, I don\'t call a guy. I am the guy.',
  },
  {
    id: 'contact',
    label: 'Say hello',
    tag: 'Contact',
    title: 'Say hi',
    color: '#f472b6',
    text:
      'Got an idea, a project, or just want to chat about AI, code or bikes? Drop me a line, I\'d love to hear from you.',
    links: contactLinks,
  },
];
