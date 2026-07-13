import { RepoView } from "@/features/repo-list/RepoView";

interface PageProps {
  params: Promise<{ owner: string; repo: string }>;
}

export default async function RepoPullsPage({ params }: PageProps) {
  const { owner, repo } = await params;
  return <RepoView owner={owner} repo={repo} />;
}
