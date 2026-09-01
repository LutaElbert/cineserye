export const CINEMA_DRAFT_DOMAIN_PREFIX = 'cinema.';

export type CinemaDraftRole =
  | 'story'
  | 'scene'
  | 'shot'
  | 'character'
  | 'location'
  | 'prop'
  | 'visual-element'
  | 'note';

export type CinemaDraftDescriptor = Readonly<{
  role: CinemaDraftRole;
  domainType: `cinema.${CinemaDraftRole}`;
  label: string;
  group: 'Story' | 'Production' | 'Workspace';
  namePrefix: string;
  eyebrow: string;
  tone: 'ink' | 'indigo' | 'mint';
  description: string;
}>;

const descriptors: readonly CinemaDraftDescriptor[] = [
  { role: 'story', domainType: 'cinema.story', label: 'Story premise', group: 'Story', namePrefix: 'Story Premise', eyebrow: 'Story', tone: 'indigo', description: 'The dramatic idea that scenes develop.' },
  { role: 'scene', domainType: 'cinema.scene', label: 'Scene', group: 'Story', namePrefix: 'Scene', eyebrow: 'Scene', tone: 'ink', description: 'One continuous dramatic unit that can be planned.' },
  { role: 'shot', domainType: 'cinema.shot', label: 'Shot', group: 'Story', namePrefix: 'Shot', eyebrow: 'Shot', tone: 'mint', description: 'A draft camera setup inside a scene.' },
  { role: 'character', domainType: 'cinema.character', label: 'Character', group: 'Production', namePrefix: 'Character', eyebrow: 'Character', tone: 'mint', description: 'A performer or story subject with continuity needs.' },
  { role: 'location', domainType: 'cinema.location', label: 'Location', group: 'Production', namePrefix: 'Location', eyebrow: 'Location', tone: 'ink', description: 'A place or set used by one or more shots.' },
  { role: 'prop', domainType: 'cinema.prop', label: 'Prop', group: 'Production', namePrefix: 'Prop', eyebrow: 'Prop', tone: 'ink', description: 'A handled or story-significant object.' },
  { role: 'visual-element', domainType: 'cinema.visual-element', label: 'Visual element', group: 'Production', namePrefix: 'Visual Element', eyebrow: 'Visual Element', tone: 'indigo', description: 'A recurring motif, effect, or composition constraint.' },
  { role: 'note', domainType: 'cinema.note', label: 'Note', group: 'Workspace', namePrefix: 'Note', eyebrow: 'Note', tone: 'indigo', description: 'A flexible production or creative note.' },
] as const;

const byRole = new Map(descriptors.map((descriptor) => [descriptor.role, descriptor]));
const byDomainType = new Map(descriptors.map((descriptor) => [descriptor.domainType, descriptor]));

export const CINEMA_DRAFT_DESCRIPTORS = descriptors;

export function cinemaDraftDescriptor(role: CinemaDraftRole): CinemaDraftDescriptor {
  return byRole.get(role)!;
}

export function cinemaDraftRole(domainType: string | undefined, eyebrow?: string): CinemaDraftRole | null {
  const explicit = domainType ? byDomainType.get(domainType as CinemaDraftDescriptor['domainType']) : undefined;
  if (explicit) return explicit.role;
  const normalized = eyebrow?.trim().toLocaleLowerCase();
  if (normalized === 'story' || normalized === 'story premise') return 'story';
  if (normalized === 'scene') return 'scene';
  if (normalized === 'shot') return 'shot';
  if (normalized === 'character') return 'character';
  if (normalized === 'location') return 'location';
  if (normalized === 'prop' || normalized === 'hero prop') return 'prop';
  if (normalized === 'visual element') return 'visual-element';
  if (normalized === 'note') return 'note';
  return null;
}

export function cinemaRelativeRole(
  sourceRole: CinemaDraftRole | null,
  relation: 'child' | 'sibling',
): CinemaDraftRole | null {
  if (!sourceRole) return null;
  if (relation === 'child') {
    if (sourceRole === 'story') return 'scene';
    if (sourceRole === 'scene') return 'shot';
    return 'note';
  }
  if (sourceRole === 'scene') return 'scene';
  if (sourceRole === 'shot') return 'shot';
  if (sourceRole === 'story') return 'note';
  return sourceRole;
}

export function cinemaRelativeLabel(
  sourceRole: CinemaDraftRole | null,
  relation: 'child' | 'sibling',
): string {
  const role = cinemaRelativeRole(sourceRole, relation);
  if (!role) return relation === 'child' ? 'Add child' : 'Add sibling';
  if (sourceRole === 'scene' && relation === 'sibling') return 'Add next scene';
  if (sourceRole === 'shot' && relation === 'sibling') return 'Add next shot';
  return `Add ${cinemaDraftDescriptor(role).label.toLocaleLowerCase()}`;
}

export function nextCinemaDraftName(
  role: CinemaDraftRole,
  existingNames: readonly string[],
): string {
  const descriptor = cinemaDraftDescriptor(role);
  if (role === 'story' && !existingNames.includes(descriptor.namePrefix)) return descriptor.namePrefix;
  const expression = new RegExp(`^${descriptor.namePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(\\d+)$`, 'i');
  const highest = existingNames.reduce((maximum, name) => {
    const match = expression.exec(name.trim());
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `${descriptor.namePrefix} ${String(highest + 1).padStart(2, '0')}`;
}
