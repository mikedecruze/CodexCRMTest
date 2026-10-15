import {
  authenticated,
  date,
  entity,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { ClientGroup } from "./ClientGroup.js";
import { ImportBatch } from "./ImportBatch.js";

// Direct GraphQL access remains denied until the secured Fabric adapter is deployed.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ImportException {
  @uuid() id!: string;
  @uuid({ optional: false }) batch_id!: string;
  @one(() => ImportBatch, { optional: false }) batch!: ImportBatch;
  @uuid({ optional: true }) group_id?: string;
  @one(() => ClientGroup, { optional: true }) group?: ClientGroup;
  @text({ max: 2000, optional: false }) externalSourceId!: string;
  @text({ max: 2000, optional: false }) externalReference!: string;
  @text({ max: 2000, optional: false }) code!: string;
  @text({ max: 2000, optional: false }) message!: string;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
