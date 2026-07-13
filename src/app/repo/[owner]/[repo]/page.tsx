import { RepoHome } from "@/features/repo-home/RepoHome";

interface PageProps {
  params: Promise<{ owner: string; repo: string }>;
}

export default async function RepoPage({ params }: PageProps) {
  const { owner, repo } = await params;
  return <RepoHome owner={owner} repo={repo} />;
}
