import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Clock3,
  Landmark,
  Plus,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Bootstrap } from "../../shared/types";
import { type FormRequest } from "../components/RecordForm";

import { Avatar, Badge, Empty, PageHeading } from "../components/ui";

export function HomePage({
  boot,
  onForm,
}: {
  boot: Bootstrap;
  onForm: (r: FormRequest) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title={`Good to see you, ${boot.user.displayName.split(" ")[0]}.`}
        description="Every relationship has a bigger picture. Here’s yours."
        action={
          <Link className="btn" to="/groups">
            View client groups
            <ArrowUpRight size={16} />
          </Link>
        }
      />
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">CONNECTED BY DESIGN</span>
          <h2>
            Great relationships start
            <br />
            with a clear understanding.
          </h2>
          <p>
            Explore the people, structures and advisors behind your families.
          </p>
          <Link className="text-link" to="/groups">
            Explore your relationships
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="relationship-art" aria-hidden="true">
          <div className="art-line one" />
          <div className="art-line two" />
          <div className="art-line three" />
          <div className="art-node center">
            <Users size={30} />
          </div>
          <div className="art-node n1">
            <Landmark size={22} />
          </div>
          <div className="art-node n2">
            <Building2 size={22} />
          </div>
          <div className="art-node n3">
            <Users size={22} />
          </div>
          <span className="art-label a1">Family</span>
          <span className="art-label a2">Legacy</span>
          <span className="art-label a3">Connection</span>
        </div>
      </div>
      <div className="stats-grid">
        {[
          {
            label: "Client Groups",
            value: boot.stats.groups,
            Icon: Users,
            to: "/groups",
            note: "Authorized relationships",
          },
          {
            label: "Individuals",
            value: boot.stats.people,
            Icon: Users,
            to: "/individuals",
            note: "Family members across generations",
          },
          {
            label: "Entities & trusts",
            value: boot.stats.entities,
            Icon: Landmark,
            to: "/entities",
            note: "Connected legal structures",
          },
          {
            label: "External advisors",
            value: boot.stats.advisors,
            Icon: Building2,
            to: "/advisors",
            note: "Trusted professional records",
          },
        ].map(({ label, value, Icon, to, note }) => (
          <Link to={to} className="stat-card" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value.toString().padStart(2, "0")}</strong>
            <p>{note}</p>
            <ArrowUpRight className="stat-arrow" size={16} />
          </Link>
        ))}
      </div>
      <div className="home-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>My client relationships</h2>
              <p>A closer look at your assigned families</p>
            </div>
            <Link className="text-link" to="/groups">
              View all
              <ArrowRight size={15} />
            </Link>
          </div>
          {boot.groups
            .filter((g) => g.status !== "Archived")
            .slice(0, 5)
            .map((g) => (
              <Link to={`/groups/${g.id}`} className="family-row" key={g.id}>
                <Avatar name={g.name} />
                <div>
                  <strong>{g.name}</strong>
                  <span>
                    {g.peopleCount} individuals · {g.entityCount} entities ·{" "}
                    {g.team}
                  </span>
                </div>
                <Badge>{g.status}</Badge>
                <ChevronRight size={17} />
              </Link>
            ))}
          {!boot.groups.length && (
            <Empty
              title="No client relationships assigned"
              description="An administrator can add you to a service team. Shared entities do not grant access to other families."
            />
          )}
        </section>
        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Build a fuller picture</h2>
              <p>Keep the relationship model connected</p>
            </div>
          </div>
          {[
            {
              type: "person",
              Icon: Users,
              label: "Add an individual",
              note: "Family members and key contacts",
            },
            {
              type: "entity",
              Icon: Landmark,
              label: "Add an entity or trust",
              note: "Structures, ownership and fiduciaries",
            },
            {
              type: "advisor",
              Icon: Building2,
              label: "Add a trusted advisor",
              note: "Professionals and their organizations",
            },
          ].map(({ type, Icon, label, note }) => (
            <button
              className="quick-action"
              key={type}
              disabled={!boot.groups.some((g) => g.canEdit)}
              onClick={() => onForm({ type })}
            >
              <span className="quick-icon">
                <Icon size={19} />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{note}</small>
              </span>
              <Plus size={16} />
            </button>
          ))}
          <div className="scope-note">
            <Clock3 size={17} />
            <p>
              <strong>A focused foundation</strong>
              <br />
              Tasks, meetings and contract alerts arrive in subsequent phases.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
