import {
  authenticated,
  date,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { Employee } from "./Employee.js";
import { ServiceTeam } from "./ServiceTeam.js";

// Deliberately deny all direct GraphQL reads until the secured Fabric adapter exists.
// No direct create/update/delete permissions are declared.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ClientGroup {
  @uuid() id!: string;
  @text({ max: 1000, optional: false }) groupName!: string;
  @text({ max: 1000, optional: false }) displayName!: string;
  @text({ max: 1000, optional: false }) status!: string;
  @date({ optional: false }) inceptionDate!: Date;
  @uuid({ optional: false }) primaryPartner_id!: string;
  @one(() => Employee, { optional: false }) primaryPartner!: Employee;
  @uuid({ optional: false }) primaryManager_id!: string;
  @one(() => Employee, { optional: false }) primaryManager!: Employee;
  @uuid({ optional: false }) primaryTeam_id!: string;
  @one(() => ServiceTeam, { optional: false }) primaryTeam!: ServiceTeam;
  @text({ max: 1000, optional: true }) sharepointUrl?: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
