import {
  authenticated,
  date,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { ClientGroup } from "./ClientGroup.js";
import { Employee } from "./Employee.js";

// Deliberately deny all direct GraphQL reads until the secured Fabric adapter exists.
// No direct create/update/delete permissions are declared.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class AuditLog {
  @uuid() id!: string;
  @uuid({ optional: true }) group_id?: string;
  @one(() => ClientGroup, { optional: true }) group?: ClientGroup;
  @uuid({ optional: false }) actor_id!: string;
  @one(() => Employee, { optional: false }) actor!: Employee;
  @text({ max: 40 }) accessClassification!: string;
  @text({ max: 1000, optional: false }) action!: string;
  @uuid({ optional: false }) recordId!: string;
  @text({ max: 8000, optional: true }) beforeJson?: string;
  @text({ max: 8000, optional: true }) afterJson?: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
