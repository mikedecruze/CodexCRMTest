import { Employee } from "./Employee.js";
import { ServiceTeam } from "./ServiceTeam.js";
import { ServiceTeamMembership } from "./ServiceTeamMembership.js";
import { ClientGroup } from "./ClientGroup.js";
import { AssignmentHistory } from "./AssignmentHistory.js";
import { GroupGrant } from "./GroupGrant.js";
import { Party } from "./Party.js";
import { PersonProfile } from "./PersonProfile.js";
import { LegalEntityProfile } from "./LegalEntityProfile.js";
import { AdvisorOrganizationProfile } from "./AdvisorOrganizationProfile.js";
import { ClientGroupParty } from "./ClientGroupParty.js";
import { Household } from "./Household.js";
import { HouseholdMembership } from "./HouseholdMembership.js";
import { ClientGroupStakeholder } from "./ClientGroupStakeholder.js";
import { ProfessionalAffiliation } from "./ProfessionalAffiliation.js";
import { PartyRelationship } from "./PartyRelationship.js";
import { ReferenceType } from "./ReferenceType.js";
import { AuditLog } from "./AuditLog.js";
export const schema = [
  Employee,
  ServiceTeam,
  ServiceTeamMembership,
  ClientGroup,
  AssignmentHistory,
  GroupGrant,
  Party,
  PersonProfile,
  LegalEntityProfile,
  AdvisorOrganizationProfile,
  ClientGroupParty,
  Household,
  HouseholdMembership,
  ClientGroupStakeholder,
  ProfessionalAffiliation,
  PartyRelationship,
  ReferenceType,
  AuditLog,
];
export type TroveSchema = {
  Employee: Employee;
  ServiceTeam: ServiceTeam;
  ServiceTeamMembership: ServiceTeamMembership;
  ClientGroup: ClientGroup;
  AssignmentHistory: AssignmentHistory;
  GroupGrant: GroupGrant;
  Party: Party;
  PersonProfile: PersonProfile;
  LegalEntityProfile: LegalEntityProfile;
  AdvisorOrganizationProfile: AdvisorOrganizationProfile;
  ClientGroupParty: ClientGroupParty;
  Household: Household;
  HouseholdMembership: HouseholdMembership;
  ClientGroupStakeholder: ClientGroupStakeholder;
  ProfessionalAffiliation: ProfessionalAffiliation;
  PartyRelationship: PartyRelationship;
  ReferenceType: ReferenceType;
  AuditLog: AuditLog;
};
