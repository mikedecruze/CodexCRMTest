import {
  authenticated,
  date,
  entity,
  int,
  one,
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
export class FinancialConvention {
  @uuid() id!: string;
  @int({ optional: false }) lookbackMonths!: number;
  @date({ optional: false }) recordedAt!: Date;
  @uuid({ optional: false }) createdBy_id!: string;
  @one(() => Employee, { optional: false }) createdBy!: Employee;
  @date() createdAt!: Date;
  @date() updatedAt!: Date;
}
