import { Metadata } from "next";

import { getJobSourceList, getStatusList } from "@/actions/job.actions";
import JobsContainer from "@/components/myjobs/JobsContainer";
import { getAllCompanies } from "@/actions/company.actions";
import { getAllJobTitles } from "@/actions/jobtitle.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";
import { getAllTags } from "@/actions/tag.actions";
import LocalJobs from "@/components/local/LocalJobs";

export const metadata: Metadata = {
  title: process.env.JBCN_LOCAL === "1" ? "岗位" : "My Jobs",
};

async function MyJobs() {
  if (process.env.JBCN_LOCAL === "1") return <LocalJobs />;
  const [statuses, companies, titles, locations, sources, tags] =
    await Promise.all([
      getStatusList(),
      getAllCompanies(),
      getAllJobTitles(),
      getAllJobLocations(),
      getJobSourceList(),
      getAllTags(),
    ]);
  return (
    <div className="col-span-3">
      <JobsContainer
        companies={companies}
        titles={titles}
        locations={locations}
        sources={sources}
        statuses={statuses}
        tags={tags ?? []}
      />
    </div>
  );
}

export default MyJobs;
