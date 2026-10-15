import { ArrowRight, Leaf } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeading } from "../components/ui";

export function AboutPage() {
  return (
    <>
      <PageHeading
        eyebrow="ABOUT THIS WORKSPACE"
        title="A foundation for lasting relationships."
        description="Trove Relationship Manager · Phase 2"
      />
      <section className="panel about-panel">
        <Leaf size={30} />
        <h2>Core relationships, thoughtfully connected.</h2>
        <p>
          This working development application uses synthetic families, people,
          entities and advisors. It includes persistent relationship records,
          effective-dated ownership, household membership, search, scoped
          authorization and an audit trail. Phase 2 adds immutable financial
          observations, attributed overrides, service history, staffing measures
          and portfolio reporting against mock Fabric data.
        </p>
        <h3>Development and authentication</h3>
        <p>
          Demo sign-in uses explicit test identities. The Entra OIDC path
          requires a real tenant app registration and provisioned employee
          identities. The local API and SQLite database are development
          adapters. A Fabric backend adapter and tenant-level validation remain
          required before deployment or use with real client data.
        </p>
        <h3>Coming in subsequent phases</h3>
        <p>
          Contracts, service coordination, initiatives and activities remain
          deferred. Financial source mappings and the read-only connector
          contract currently use synthetic data; no real datalake is connected.
        </p>
        <Link className="text-link" to="/groups">
          Return to client groups
          <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
