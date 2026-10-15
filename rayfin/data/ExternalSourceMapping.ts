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

// Direct GraphQL access remains denied until the secured Fabric adapter is deployed.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ExternalSourceMapping {
  @uuid() id!: string;
  @uuid({ optional: false }) group_id!: string;
  @one(() => ClientGroup, { optional: false }) group!: ClientGroup;
  @uuid({ optional: false }) internalRecordId!: string;
  @text({ max: 2000, optional: false }) internalRecordType!: string;
  @text({ max: 2000, optional: false }) sourceSystem!: string;
  @text({ max: 2000, optional: false }) sourceObjectType!: string;
  @text({ max: 2000, optional: false }) externalSourceId!: string;
  @text({ max: 2000, optional: false }) mappingStatus!: string;
  @date({ optional: false }) lastVerifiedAt!: Date;
  @uuid({ optional: false }) createdBy_id!: string;
  @one(() => Employee, { optional: false }) createdBy!: Employee;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
