export type PartyKind = "PERSON" | "LEGAL_ENTITY" | "ADVISOR_ORGANIZATION";
export type Level = "Partner" | "Director" | "Manager" | "Senior" | "Associate";
export interface Employee {
  id: string;
  displayName: string;
  email: string;
  level: Level;
  role: "admin" | "employee";
  active: number;
}
export interface Team {
  id: string;
  name: string;
  description: string;
  active: number;
}
export interface Reference {
  id: string;
  category: string;
  code: string;
  label: string;
  symmetric: number;
  ownership: number;
  active: number;
}
export interface Group {
  id: string;
  name: string;
  displayName: string;
  status: string;
  inceptionDate: string;
  partnerId: string;
  managerId: string;
  teamId: string;
  sharepointUrl: string | null;
  partner: string;
  manager: string;
  team: string;
  peopleCount: number;
  entityCount: number;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}
export interface Party {
  id: string;
  kind: PartyKind;
  displayName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  birthDate?: string | null;
  deceasedDate?: string | null;
  email?: string;
  phone?: string;
  occupation?: string;
  primaryGroupId?: string | null;
  legalName?: string;
  entityTypeId?: string;
  entityType?: string;
  jurisdiction?: string;
  formationDate?: string | null;
  taxClassification?: string;
  description?: string;
  organizationType?: string;
  website?: string;
  address?: string;
  groupId?: string;
  associationId?: string;
  associationType?: string;
  billable?: number;
  notes?: string;
  groupName?: string;
  advisorType?: string;
  stakeholderId?: string;
  scope?: string;
  startDate?: string;
  endDate?: string | null;
  primaryAdvisor?: number;
  affiliations?: {
    id: string;
    organizationId: string;
    organization: string;
    position: string;
    startDate: string;
    endDate: string | null;
  }[];
}
export interface Household {
  id: string;
  groupId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string | null;
  members: {
    id: string;
    personId: string;
    name: string;
    role: string;
    isPrimary: number;
    startDate: string;
    endDate: string | null;
  }[];
}
export interface Relationship {
  id: string;
  groupId: string;
  sourceId: string;
  targetId: string;
  typeId: string;
  type: string;
  code: string;
  ownership: number;
  symmetric: number;
  startDate: string;
  endDate: string | null;
  ownershipPercentage: number | null;
  votingPercentage: number | null;
  economicPercentage: number | null;
  ownershipClass: string;
  notes: string;
  sourceDocument: string;
}
export interface GroupDetail {
  group: Group;
  people: Party[];
  entities: Party[];
  advisors: Party[];
  households: Household[];
  relationships: Relationship[];
  asOf: string;
  assignments: {
    id: string;
    partner: string;
    manager: string;
    team: string;
    startDate: string;
    endDate: string | null;
  }[];
}
export interface Bootstrap {
  user: Employee;
  demo: boolean;
  employees: Employee[];
  teams: Team[];
  references: Reference[];
  groups: Group[];
  stats: { groups: number; people: number; entities: number; advisors: number };
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface Audit {
  id: string;
  groupId: string | null;
  actor: string;
  action: string;
  recordId: string;
  before: string | null;
  after: string | null;
  createdAt: string;
}
