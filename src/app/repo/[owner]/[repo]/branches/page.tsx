import { BranchList } from "@/features/branch-list/BranchList";

interface PageProps {
  params: Promise<{ owner: string; repo: string }>;
}

export default async function RepoBranchesPage({ params }: PageProps) {
  const { owner, repo } = await params;
  return <BranchList owner={owner} repo={repo} />;
}
