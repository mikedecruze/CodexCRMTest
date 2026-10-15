import {
  authenticated,
  date,
  entity,
  int,
  one,
  text,
  uuid,
} from "@microsoft/rayfin-core";
import { Employee } from "./Employee.js";

// Direct GraphQL access remains denied until the secured Fabric adapter is deployed.
@entity()
@authenticated("read", {
  policy: (claims) =>
    claims.sub
      .eq("TROVE_DIRECT_ACCESS_DISABLED")
      .and(claims.sub.eq("TROVE_NO_MATCH")),
})
export class ImportBatch {
  @uuid() id!: string;
  @text({ max: 2000, optional: false }) sourceSystem!: string;
  @text({ max: 2000, optional: false }) status!: string;
  @date({ optional: false }) startedAt!: Date;
  @date({ optional: true }) completedAt?: Date;
  @uuid({ optional: false }) createdBy_id!: string;
  @one(() => Employee, { optional: false }) createdBy!: Employee;
  @int({ optional: false }) importedCount!: number;
  @int({ optional: false }) skippedCount!: number;
  @int({ optional: false }) errorCount!: number;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
